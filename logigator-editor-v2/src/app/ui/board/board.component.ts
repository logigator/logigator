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
import { MinimapComponent } from './minimap/minimap.component';
import { MultiTouchGesture } from '../../rendering/multi-touch-gesture';
import { RendererHandleService } from '../../rendering/renderer-handle.service';

// Off-screen scene nodes (quad-tree branches, components, wires) are skipped at
// render time when marked `cullable`. CullerPlugin (priority 10) initialises
// before TickerPlugin (which captures `app.render` by reference), so the cull
// pass runs on every ticker-driven render. Added once at module load.
extensions.add(CullerPlugin);

@Component({
  selector: 'app-board',
  imports: [FpsCounterComponent, MinimapComponent],
  templateUrl: './board.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative' }
})
export class BoardComponent implements OnInit, OnDestroy {
  private readonly hostEl = inject(ElementRef);
  private readonly themingService = inject(ThemingService);
  private readonly assetsService = inject(AssetsService);
  private readonly workModeService = inject(WorkModeService);
  private readonly rendererHandle = inject(RendererHandleService);
  protected readonly editorSettings = inject(EditorSettingsService);

  @ViewChild('canvas', { static: true })
  protected readonly canvas!: ElementRef<HTMLCanvasElement>;

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

  // Two-finger pan + pinch-zoom. Driven by native pointer events on the canvas
  // (reliable multi-touch with a stable pointerId), not PixiJS federated events
  // whose two-finger delivery is finicky. Targets whatever project is active.
  private readonly _gesture = new MultiTouchGesture({
    pan: (delta) => this.project()?.pan(delta),
    zoomBy: (factor, center) => this.project()?.zoomBy(factor, center),
    abortActiveDrag: () => this.project()?.abortActiveDrag(),
    setActive: (active) => this.project()?.triggerTicker(active ? 'on' : 'off')
  });
  private readonly _gestureListeners = new AbortController();
  // Cached at gesture start; the full-bleed canvas does not move mid-gesture.
  private _canvasRect: DOMRect | null = null;

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

    // Wire the gesture listeners *after* app.init so PixiJS's federated
    // pointerdown handler (registered during init, on the same canvas) runs
    // before ours. On a second-finger-down that ordering matters: PixiJS sees
    // the first finger's drag still active and its `if (_activeDrag) return`
    // guard skips starting a session for the second finger; only then does our
    // handler abort the first finger's drag and take over the gesture. Wiring
    // earlier would invert that and leak a stray single-pointer session.
    this._wireTouchGestures();

    // Expose the renderer for offscreen snapshots (image export, server
    // previews). Cleared in ngOnDestroy before the app is destroyed.
    this.rendererHandle.set(this.app.renderer);

    this.appInitialized = true;
    this.loaded.set(true);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this._gestureListeners.abort();
    this._resizeObserver?.disconnect();
    this._renderScheduler?.destroy();
    this.rendererHandle.set(null);
    if (this.appInitialized) {
      this.app.destroy();
    }
  }

  /**
   * Routes native touch-pointer events on the canvas into the multi-touch
   * gesture. Only `pointerType === 'touch'` is tracked — mouse/pen keep their
   * existing single-pointer path (PanSession, right-drag pan, wheel zoom). Touch
   * pointers have implicit capture, so move/up still arrive after a finger
   * leaves the canvas bounds.
   */
  private _wireTouchGestures(): void {
    const canvas = this.canvas.nativeElement;
    const opts = { signal: this._gestureListeners.signal };

    const toLocal = (e: PointerEvent): { x: number; y: number } => {
      const rect = this._canvasRect ?? canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    canvas.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType !== 'touch') return;
        this._canvasRect = canvas.getBoundingClientRect();
        const p = toLocal(e);
        this._gesture.onPointerDown(e.pointerId, p.x, p.y);
      },
      opts
    );

    canvas.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType !== 'touch') return;
        const p = toLocal(e);
        this._gesture.onPointerMove(e.pointerId, p.x, p.y);
      },
      opts
    );

    const onUp = (e: PointerEvent): void => {
      if (e.pointerType !== 'touch') return;
      this._gesture.onPointerUp(e.pointerId);
    };
    canvas.addEventListener('pointerup', onUp, opts);
    canvas.addEventListener('pointercancel', onUp, opts);
  }
}
