import {
  ChangeDetectionStrategy,
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
import { Application, CullerPlugin, extensions, Point, Ticker } from 'pixi.js';
import { ThemingService } from '../../theming/theming.service';
import { Project } from '../../project/project';
import { AssetsService } from '../../rendering/assets.service';
import { filter, merge, Subject, takeUntil, throttleTime } from 'rxjs';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { TickerScheduler } from '../../rendering/ticker-scheduler';
import { EditorSettingsService } from '../../settings/editor-settings.service';
import { FpsCounterComponent } from './fps-counter/fps-counter.component';

// Off-screen scene nodes (quad-tree branches, components, wires) are skipped at
// render time when marked `cullable`. CullerPlugin (priority 10) initialises
// before TickerPlugin (which captures `app.render` by reference), so the cull
// pass runs on every ticker-driven render. Added once at module load.
extensions.add(CullerPlugin);

@Component({
  selector: 'app-board',
  imports: [FpsCounterComponent],
  templateUrl: './board.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative' }
})
export class BoardComponent implements OnInit, OnDestroy {
  private readonly hostEl = inject(ElementRef);
  private readonly themingService = inject(ThemingService);
  private readonly assetsService = inject(AssetsService);
  private readonly workModeService = inject(WorkModeService);
  protected readonly editorSettings = inject(EditorSettingsService);

  @ViewChild('canvas', { static: true })
  protected readonly canvas!: ElementRef<HTMLCanvasElement>;

  public readonly positionChange = output<Point>();
  public readonly cursorPositionChange = output<Point>();
  public readonly project = input<Project | null>(null);

  protected readonly loaded = signal(false);

  private readonly destroy$ = new Subject<void>();
  private readonly projectChange$ = new Subject<Project | null>();

  private readonly app: Application = new Application();
  private appInitialized = false;
  private _pointerInsideCanvas = false;
  private _renderScheduler: TickerScheduler | null = null;
  private _resizeObserver: ResizeObserver | null = null;

  /** The render loop's ticker; only valid once `loaded()` is true. */
  protected get ticker(): Ticker {
    return this.app.ticker;
  }

  constructor() {
    this.projectChange$.pipe(takeUntil(this.destroy$)).subscribe((project) => {
      if (!project) {
        return;
      }

      project.resizeViewport(this.app.renderer.width, this.app.renderer.height);

      this.app.stage = project;
      this.app.ticker.update();

      this.positionChange.emit(project.gridPosition);

      project.positionChange$
        .pipe(
          takeUntil(merge(this.destroy$, this.projectChange$)),
          throttleTime(33.33)
        )
        .subscribe((pos) => {
          this.positionChange.emit(pos);
        });

      project.cursorPosition$
        .pipe(
          takeUntil(merge(this.destroy$, this.projectChange$)),
          filter(() => this._pointerInsideCanvas),
          throttleTime(33.33)
        )
        .subscribe((pos) => {
          this.cursorPositionChange.emit(pos);
        });

      // One scheduler per project; drop the previous so its run-count and any
      // queued frame don't leak across stages.
      this._renderScheduler?.destroy();
      this._renderScheduler = new TickerScheduler(
        this.app.ticker,
        project.ticker$
      );
    });

    effect(() => {
      if (!this.loaded()) {
        return;
      }

      this.projectChange$.next(this.project());
    });

    effect(() => {
      const project = this.project();
      if (!project) {
        return;
      }

      project.mode = this.workModeService.mode();
      project.componentToPlace = this.workModeService.selectedComponentConfig();
    });

    effect(() => {
      this.project()?.setGridVisible(this.editorSettings.showGrid.value());
    });

    // The renderer background is read once at app.init; keep it in sync with the
    // theme. Per-element colors are handled by each Project's own theme effect.
    effect(() => {
      const background = this.themingService.currentTheme().background;
      if (!this.loaded()) {
        return;
      }
      this.app.renderer.background.color = background;
      this.project()?.triggerTicker('single');
    });
  }

  async ngOnInit(): Promise<void> {
    await this.assetsService.init();

    this.canvas.nativeElement.addEventListener('pointerenter', () => {
      this._pointerInsideCanvas = true;
    });
    this.canvas.nativeElement.addEventListener('pointerleave', () => {
      this._pointerInsideCanvas = false;
    });

    await this.app.init({
      canvas: this.canvas.nativeElement,
      resizeTo: this.hostEl.nativeElement,
      preference: 'webgpu',
      antialias: true,
      hello: false,
      powerPreference: 'high-performance',
      backgroundColor: this.themingService.currentTheme().background,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      autoStart: false,
      // Recompute transforms during the cull pass. The Culler runs before the
      // render, so by default it reads each node's stale (previous-frame)
      // worldTransform — after a pan/zoom the newly-revealed edge elements
      // would be culled until the next render. updateTransform keeps culling
      // in step with the current viewport.
      culler: { updateTransform: true }
    });

    this.app.renderer.on('resize', (w, h) => {
      const project = this.project();
      if (!project) {
        return;
      }

      project.resizeViewport(w, h);
    });

    // `resizeTo` only re-measures on window `resize` events, so layout changes
    // that resize the host without resizing the window (e.g. the side bar
    // disappearing in simulation mode) leave the canvas stale. Observe the host
    // directly and let the plugin re-measure on the next frame.
    this._resizeObserver = new ResizeObserver(() => this.app.queueResize());
    this._resizeObserver.observe(this.hostEl.nativeElement);

    this.appInitialized = true;
    this.loaded.set(true);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this._resizeObserver?.disconnect();
    this._renderScheduler?.destroy();
    if (this.appInitialized) {
      this.app.destroy();
    }
  }
}
