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
import { Culler, Point, Rectangle, Ticker } from 'pixi.js';
import { ThemingService } from '../../theming/theming.service';
import { Project } from '../../project/project';
import { AssetsService } from '../../rendering/assets.service';
import { Subject, takeUntil, throttleTime } from 'rxjs';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { WorkMode } from '../../work-mode/work-mode.enum';
import { TickerScheduler } from '../../rendering/ticker-scheduler';
import { EditorSettingsService } from '../../settings/editor-settings.service';
import { FpsCounterComponent } from './fps-counter/fps-counter.component';
import { PointerController } from '../../rendering/interaction/pointer-controller';
import { WorkModeRouter } from '../../rendering/interaction/work-mode-router';
import {
  RendererLease,
  RendererService
} from '../../rendering/renderer.service';

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
  /** The host's CSS box — the visible area the cull pass tests against. */
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

      project.resizeViewport(this._view.width, this._view.height);
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

    // The negation-mode port preview reads as clickable; every other mode
    // keeps the default canvas cursor.
    effect(() => {
      this.canvas.nativeElement.style.cursor =
        this.workModeService.mode() === WorkMode.PORT_NEGATION ? 'pointer' : '';
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
    await this.assetsService.init();

    const lease = await this.rendererService.acquire();
    if (this._destroyed) {
      lease.release();
      return;
    }
    this._lease = lease;

    this._measureView();
    // The canvas fills the host via CSS; the backing store follows per render.
    // Observe the host so layout changes that don't resize the window (e.g.
    // the side bar disappearing in simulation mode) still resize the board.
    this._resizeObserver = new ResizeObserver(() => this._onHostResize());
    this._resizeObserver.observe(this.hostEl.nativeElement);

    this._controller = new PointerController({
      canvas: this.canvas.nativeElement,
      project: () => this._router.project,
      nav: {
        pan: (delta) => this._router.project?.pan(delta),
        zoomIn: (center) => this._router.project?.zoomIn(center),
        zoomOut: (center) => this._router.project?.zoomOut(center),
        zoomBy: (factor, center) =>
          this._router.project?.zoomBy(factor, center),
        setActive: (active) =>
          this._router.project?.triggerTicker(active ? 'on' : 'off')
      },
      tool: this._router,
      onCursorMove: (grid) => this._cursorMove$.next(grid)
    });

    this.loaded.set(true);
  }

  ngOnDestroy(): void {
    this._destroyed = true;
    this.destroy$.next();
    this._controller?.destroy();
    this._router.destroy();
    this._resizeObserver?.disconnect();
    this._renderScheduler?.destroy();
    this._ticker.destroy();
    this._lease?.release();
    this._lease = null;
  }

  /**
   * One board frame: cull the scene against the viewport (recomputing
   * transforms so a pan/zoom can't leave newly-revealed edge elements hidden),
   * then blit through the shared renderer.
   */
  private _renderFrame(): void {
    const project = this.project();
    if (!project || !this._lease) {
      return;
    }
    Culler.shared.cull(project, this._view, false);
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
    if (!project) {
      return;
    }
    project.resizeViewport(this._view.width, this._view.height);
    project.triggerTicker('single');
  }
}
