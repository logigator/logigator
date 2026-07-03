import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  signal,
  viewChild
} from '@angular/core';
import { Rectangle } from 'pixi.js';
import { debounceTime, merge, Subject, takeUntil } from 'rxjs';
import { Project } from '../../../project/project';
import { BoardSnapshotService } from '../../../rendering/board-snapshot.service';
import { ThemingService } from '../../../theming/theming.service';
import { environment } from '../../../../environments/environment';
import { fitRegion, MapFit, mapViewportRect, nextFrame } from './minimap-frame';

/** Panel dimensions (CSS px). */
const PANEL_WIDTH = 200;
const PANEL_HEIGHT = 150;
/** Quiet period after the last committed action before the map re-renders. */
const CONTENT_DEBOUNCE_MS = 200;
/** Minimum on-screen size of the viewport rectangle (CSS px). */
const MIN_RECT_SIZE_PX = 8;

/**
 * Always-available overview map in the board's corner: a shrunk render of the
 * whole circuit plus a rectangle marking the visible viewport. Two layers with
 * two update rates — the content canvas re-renders debounced on committed
 * actions (and immediately on project/theme switches), while the viewport
 * rectangle is a plain div tracking every pan/zoom via `viewportChange$`.
 *
 * The mapped region derives only from content bounds (with hysteresis, see
 * `minimap-frame.ts`), never from the camera, so panning can never force a
 * content re-render. Hidden while the project is empty — a map of nothing has
 * no navigation value.
 */
@Component({
  selector: 'app-minimap',
  templateUrl: './minimap.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'absolute bottom-3 right-3',
    '[style.display]': "hasContent() ? 'block' : 'none'"
  }
})
export class MinimapComponent implements OnDestroy {
  private readonly snapshots = inject(BoardSnapshotService);
  private readonly themingService = inject(ThemingService);

  public readonly project = input<Project | null>(null);

  protected readonly hasContent = signal(false);
  protected readonly panelWidth = PANEL_WIDTH;
  protected readonly panelHeight = PANEL_HEIGHT;

  private readonly canvasRef =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly rectRef =
    viewChild.required<ElementRef<HTMLDivElement>>('rect');

  private readonly destroy$ = new Subject<void>();
  private readonly projectChange$ = new Subject<Project | null>();

  /** Currently mapped region (grid units); null until first content render. */
  private _frame: Rectangle | null = null;
  private _fit: MapFit | null = null;
  private _renderFrameId: number | null = null;
  private _rectFrameId: number | null = null;

  constructor() {
    this.projectChange$.pipe(takeUntil(this.destroy$)).subscribe((project) => {
      this._frame = null;
      this._fit = null;
      if (!project) {
        this.hasContent.set(false);
        return;
      }

      const until = merge(this.destroy$, this.projectChange$);
      project.actionManager.actionChange$
        .pipe(takeUntil(until), debounceTime(CONTENT_DEBOUNCE_MS))
        .subscribe(() => this._renderContent());
      project.viewportChange$
        .pipe(takeUntil(until))
        .subscribe(() => this._scheduleRectUpdate());

      this._scheduleRender();
    });

    effect(() => {
      this.projectChange$.next(this.project());
    });

    // Content colors are theme-baked, so a theme switch needs a fresh render.
    // The rAF deferral lets every project's own theme effect redraw the cached
    // graphics first.
    effect(() => {
      this.themingService.currentTheme();
      this._scheduleRender();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this._renderFrameId !== null) cancelAnimationFrame(this._renderFrameId);
    if (this._rectFrameId !== null) cancelAnimationFrame(this._rectFrameId);
  }

  /** Coalesces immediate-render triggers onto the next animation frame. */
  private _scheduleRender(): void {
    if (this._renderFrameId !== null) return;
    this._renderFrameId = requestAnimationFrame(() => {
      this._renderFrameId = null;
      this._renderContent();
    });
  }

  private _scheduleRectUpdate(): void {
    if (this._rectFrameId !== null) return;
    this._rectFrameId = requestAnimationFrame(() => {
      this._rectFrameId = null;
      this._updateRect();
    });
  }

  private _renderContent(): void {
    const project = this.project();
    if (!project || !this.snapshots.available) {
      this.hasContent.set(false);
      return;
    }
    if (!project.getContentBounds()) {
      this.hasContent.set(false);
      this._frame = null;
      this._fit = null;
      return;
    }
    this.hasContent.set(true);

    this._frame = nextFrame(this._frame, this.snapshots.computeRegion(project));
    this._fit = fitRegion(this._frame, this.panelWidth, this.panelHeight);

    const dpr = window.devicePixelRatio || 1;
    const canvas = this.canvasRef().nativeElement;
    const backingWidth = Math.round(this.panelWidth * dpr);
    const backingHeight = Math.round(this.panelHeight * dpr);
    if (canvas.width !== backingWidth) canvas.width = backingWidth;
    if (canvas.height !== backingHeight) canvas.height = backingHeight;

    const rendered = this.snapshots.renderRegionToCanvas(project, this._frame, {
      multiplier: (this._fit.scale * dpr) / environment.gridSize,
      background: 'transparent',
      hideText: true
    });

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      rendered,
      Math.round(this._fit.offsetX * dpr),
      Math.round(this._fit.offsetY * dpr)
    );

    // A re-frame moves the panel↔grid mapping, so re-place the rect too.
    this._updateRect();
  }

  private _updateRect(): void {
    const project = this.project();
    if (!project || !this._frame || !this._fit) return;

    const state = project.viewportState;
    const pxPerUnit = state.scale * environment.gridSize;
    const rect = mapViewportRect(
      state.gridOrigin,
      {
        x: state.viewportSize.x / pxPerUnit,
        y: state.viewportSize.y / pxPerUnit
      },
      this._frame,
      this._fit,
      this.panelWidth,
      this.panelHeight,
      MIN_RECT_SIZE_PX
    );

    const style = this.rectRef().nativeElement.style;
    style.transform = `translate(${rect.x}px, ${rect.y}px)`;
    style.width = `${rect.width}px`;
    style.height = `${rect.height}px`;
  }
}
