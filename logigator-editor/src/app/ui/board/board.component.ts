import {
  Component,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  signal,
  ViewChild
} from '@angular/core';
import { Point, Rectangle, Ticker } from 'pixi.js';
import { ThemingService } from '../../theming/theming.service';
import { Project } from '../../project/project';
import { AssetsService } from '../../rendering/assets.service';
import { Subject, takeUntil, throttleTime } from 'rxjs';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { TickerScheduler } from '../../rendering/ticker-scheduler';
import { EditorSettingsService } from '../../settings/editor-settings.service';
import { FpsCounterComponent } from './fps-counter/fps-counter.component';
import { LoggingService } from '../../logging/logging.service';
import { ToastService } from '../../logging/toast.service';
import { TranslationService } from '../../translation/translation.service';
import { PointerController } from '../../rendering/interaction/pointer-controller';
import { WorkModeRouter } from '../../rendering/interaction/work-mode-router';
import {
  RendererLease,
  RendererService
} from '../../rendering/renderer.service';
import { BoardSurfaceService } from '../../rendering/board-surface.service';

@Component({
  selector: 'app-board',
  imports: [FpsCounterComponent],
  templateUrl: './board.component.html',
  host: { class: 'relative' }
})
export class BoardComponent implements OnInit, OnDestroy {
  private readonly hostEl = inject(ElementRef);
  private readonly themingService = inject(ThemingService);
  private readonly assetsService = inject(AssetsService);
  private readonly workModeService = inject(WorkModeService);
  private readonly rendererService = inject(RendererService);
  private readonly boardSurface = inject(BoardSurfaceService);
  private readonly loggingService = inject(LoggingService);
  private readonly toastService = inject(ToastService);
  private readonly translation = inject(TranslationService);
  protected readonly editorSettings = inject(EditorSettingsService);

  @ViewChild('canvas', { static: true })
  protected readonly canvas!: ElementRef<HTMLCanvasElement>;

  public readonly cursorPositionChange = output<Point>();
  public readonly project = input<Project | null>(null);

  protected readonly loaded = signal(false);

  private readonly destroy$ = new Subject<void>();
  private readonly projectChange$ = new Subject<Project | null>();

  // The board draws through the app-wide shared renderer (see
  // RendererService); this component owns only what is per-canvas: the render
  // loop's ticker, the cull pass, and the viewport size.
  private _lease: RendererLease | null = null;
  private readonly _ticker = new Ticker();
  private _destroyed = false;
  private _renderScheduler: TickerScheduler | null = null;
  private _resizeObserver: ResizeObserver | null = null;
  /** The host's CSS box — fed to the project as its viewport size. */
  private readonly _view = new Rectangle();

  // All canvas input runs through the DOM pointer controller (PixiJS event
  // features never come into play — the shared renderer has no interactive
  // scene): the router dispatches the primary-pointer stream into per-mode
  // drag sessions, the controller handles navigation (right-drag pan, wheel
  // zoom, two-finger pan/pinch) against whatever project is active.
  private readonly _router = new WorkModeRouter();
  private _controller: PointerController | null = null;
  private readonly _cursorMove$ = new Subject<Point>();

  /** The render loop's ticker; only valid once `loaded()` is true. */
  protected get ticker(): Ticker {
    return this._ticker;
  }

  constructor() {
    this._ticker.add(this._renderFrame, this);

    this.projectChange$.pipe(takeUntil(this.destroy$)).subscribe((project) => {
      this._router.setProject(project);
      if (!project) {
        return;
      }

      project.viewport.resizeViewport(this._view.width, this._view.height);
      this._ticker.update();

      // One scheduler per project; drop the previous so its run-count and any
      // queued frame don't leak across stages.
      this._renderScheduler?.destroy();
      this._renderScheduler = new TickerScheduler(
        this._ticker,
        project.ticker$
      );
    });

    this._cursorMove$
      .pipe(takeUntil(this.destroy$), throttleTime(33.33))
      .subscribe((pos) => {
        this.cursorPositionChange.emit(pos);
      });

    effect(() => {
      if (!this.loaded()) {
        return;
      }

      this.projectChange$.next(this.project());
    });

    effect(() => {
      this._router.setMode(this.workModeService.mode());
      this._router.componentToPlace =
        this.workModeService.selectedComponentConfig();
    });

    effect(() => {
      this.project()?.setGridVisible(this.editorSettings.showGrid.value());
    });

    // The clear color is read per render, so a theme switch only needs a
    // repaint. Per-element colors are handled by each Project's own theme
    // effect.
    effect(() => {
      this.themingService.currentTheme();
      if (!this.loaded()) {
        return;
      }
      this.project()?.triggerTicker('single');
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      await this.assetsService.init();

      const lease = await this.rendererService.acquire();
      if (this._destroyed) {
        lease.release();
        return;
      }
      this._lease = lease;

      this._measureView();
      // Published for the automation API's grid ↔ screen conversions, which
      // need the canvas's page offset.
      this.boardSurface.register(this.canvas.nativeElement);
      // The canvas fills the host via CSS; the backing store follows per render.
      // Observe the host so layout changes that don't resize the window (e.g.
      // the side bar disappearing in simulation mode) still resize the board.
      this._resizeObserver = new ResizeObserver(() => this._onHostResize());
      this._resizeObserver.observe(this.hostEl.nativeElement);

      this._controller = new PointerController({
        canvas: this.canvas.nativeElement,
        project: () => this._router.project,
        nav: {
          pan: (delta) => this._router.project?.viewport.pan(delta),
          zoomIn: (center) => this._router.project?.viewport.zoomIn(center),
          zoomOut: (center) => this._router.project?.viewport.zoomOut(center),
          zoomBy: (factor, center) =>
            this._router.project?.viewport.zoomBy(factor, center),
          setActive: (active) =>
            this._router.project?.triggerTicker(active ? 'on' : 'off')
        },
        tool: this._router,
        onCursorMove: (grid) => this._cursorMove$.next(grid)
      });

      this.loaded.set(true);

      // Records which backend (WebGPU/WebGL/Canvas) the shared renderer
      // settled on when this board acquired it.
      this.loggingService.debug(
        'Renderer acquired: ' + this.rendererService.renderer?.type,
        'BoardComponent'
      );
    } catch (err) {
      // The canvas otherwise silently never appears; keep `loaded` false so the
      // board stays hidden rather than showing a dead surface.
      this.toastService.error(
        this.translation.translate('editor.rendererInitFailed'),
        'BoardComponent',
        err
      );
    }
  }

  ngOnDestroy(): void {
    this._destroyed = true;
    this.destroy$.next();
    this._controller?.destroy();
    this._router.destroy();
    this._resizeObserver?.disconnect();
    this.boardSurface.unregister(this.canvas.nativeElement);
    this._renderScheduler?.destroy();
    this._ticker.destroy();
    this._lease?.release();
    this._lease = null;
  }

  /**
   * One board frame: cull the project's quad trees against the viewport, then
   * blit through the shared renderer. The cull runs on every ticker-driven
   * render, so the culled set stays current through pan/zoom without extra
   * scheduling.
   */
  private _renderFrame(): void {
    const project = this.project();
    // The input trails the active project by a change-detection cycle, so a
    // disposed project stays bound here for one rAF after its tab closes.
    if (!project || project.destroyed || !this._lease) {
      return;
    }
    project.cull();
    this._lease.render(project, this.canvas.nativeElement);
  }

  private _measureView(): void {
    const rect = this.hostEl.nativeElement.getBoundingClientRect();
    this._view.width = Math.max(1, Math.round(rect.width));
    this._view.height = Math.max(1, Math.round(rect.height));
  }

  private _onHostResize(): void {
    this._measureView();
    const project = this.project();
    if (!project || project.destroyed) {
      return;
    }
    project.viewport.resizeViewport(this._view.width, this._view.height);
    project.triggerTicker('single');
  }
}
