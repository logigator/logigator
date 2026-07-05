import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  OnDestroy,
  untracked,
  ViewChild
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Point, Rectangle } from 'pixi.js';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Component as CircuitComponent } from '../../components/component';
import { ToastService } from '../../logging/toast.service';
import { MultiTouchGesture } from '../../rendering/multi-touch-gesture';
import { Project } from '../../project/project';
import type {
  SubCircuitWatch,
  WatchLevel
} from '../../components/custom/sub-circuit-watch';
import {
  WatchRendererLease,
  WatchRendererService
} from './watch-renderer.service';

/** Press-to-release movement below this is a click, above it a pan (px). */
const CLICK_MOVE_THRESHOLD = 5;

/**
 * Renderer for {@link SubCircuitWatch}: a canvas blitted through the shared
 * watch renderer, showing the active level's headless project (the breadcrumb
 * trail lives in the hosting header via the inspection's `titleParts`). Fits
 * the content when a level first shows, then pans/zooms through the project's
 * own viewport controller — pointer handling is plain DOM (the watch renderer
 * has no event system on its target canvases): a press that stays within a
 * small threshold is a click, routed to the model (inner input / drill-down /
 * data inspector); past it, a pan. Re-blits on engine changes (`render$`),
 * viewport/theme changes (the project's `ticker$`), and host resizes.
 */
@Component({
  selector: 'app-sub-circuit-watch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
  template: `
    <canvas
      #canvas
      class="block h-full w-full touch-none"
      (pointerdown)="onPointerDown($event)"
      (pointermove)="onPointerMove($event)"
      (pointerup)="onPointerUp($event)"
      (pointercancel)="onPointerCancel($event)"
      (wheel)="onWheel($event)"
      (contextmenu)="$event.preventDefault()"
    ></canvas>
  `
})
export class SubCircuitWatchComponent implements AfterViewInit, OnDestroy {
  public readonly inspection = input.required<SubCircuitWatch>();

  private readonly watchRenderer = inject(WatchRendererService);
  private readonly injector = inject(Injector);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  @ViewChild('canvas', { static: true })
  private readonly canvas!: ElementRef<HTMLCanvasElement>;

  private lease: WatchRendererLease | null = null;
  private destroyed = false;
  private resizeObserver: ResizeObserver | null = null;
  private readonly subs = new Subscription();
  private tickerSub: Subscription | null = null;

  private panPointer: number | null = null;
  private panLast = { x: 0, y: 0 };
  private panned = false;
  // Only a primary-button press can become a click; a right-drag only pans.
  private clickEligible = false;

  // Two-finger pan + pinch-zoom on touch. The second finger cancels any
  // single-pointer press so a finger never both clicks and navigates.
  private readonly gesture = new MultiTouchGesture({
    pan: (delta) => this.pan(delta),
    zoomBy: (factor, center) => this.project.zoomBy(factor, center),
    abortActiveDrag: () => (this.panPointer = null),
    setActive: () => undefined
  });

  private get project(): Project {
    return this.inspection().activeLevel().session.project;
  }

  ngAfterViewInit(): void {
    this.subs.add(this.inspection().render$.subscribe(() => this.render()));

    this.resizeObserver = new ResizeObserver(() => {
      this.syncViewportSize();
      this.render();
    });
    this.resizeObserver.observe(this.canvas.nativeElement);

    // Tracks breadcrumb navigation: rewires the ticker subscription and the
    // viewport to whichever level is visible.
    effect(
      () => {
        const level = this.inspection().activeLevel();
        untracked(() => this.showLevel(level));
      },
      { injector: this.injector }
    );

    void this.watchRenderer
      .acquire()
      .then((lease) => {
        if (this.destroyed) {
          lease.release();
          return;
        }
        this.lease = lease;
        this.render();
      })
      .catch((err) => {
        this.toast.error(
          this.transloco.translate('watch.rendererFailed'),
          err,
          'SubCircuitWatchComponent'
        );
      });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.subs.unsubscribe();
    this.tickerSub?.unsubscribe();
    this.resizeObserver?.disconnect();
    this.lease?.release();
    this.lease = null;
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'touch') {
      const local = this.pointerPosition(event);
      this.gesture.onPointerDown(event.pointerId, local.x, local.y);
      if (this.gesture.isActive) {
        return;
      }
    }
    // Left press: click-or-pan (past the threshold). Right press: pan only,
    // mirroring the board's right-drag pan.
    if (
      (event.button !== 0 && event.button !== 2) ||
      this.panPointer !== null
    ) {
      return;
    }
    this.clickEligible = event.button === 0;
    this.panPointer = event.pointerId;
    this.panLast = { x: event.clientX, y: event.clientY };
    this.panned = false;
    this.canvas.nativeElement.setPointerCapture(event.pointerId);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (event.pointerType === 'touch') {
      const local = this.pointerPosition(event);
      this.gesture.onPointerMove(event.pointerId, local.x, local.y);
      if (this.gesture.isActive) {
        return;
      }
    }
    if (event.pointerId !== this.panPointer) {
      return;
    }
    const dx = event.clientX - this.panLast.x;
    const dy = event.clientY - this.panLast.y;
    if (!this.panned) {
      if (
        this.clickEligible &&
        dx * dx + dy * dy <= CLICK_MOVE_THRESHOLD * CLICK_MOVE_THRESHOLD
      ) {
        return; // still within click tolerance — don't pan yet
      }
      this.panned = true;
    }
    this.panLast = { x: event.clientX, y: event.clientY };
    this.pan(new Point(dx, dy));
  }

  protected onPointerUp(event: PointerEvent): void {
    if (event.pointerType === 'touch') {
      this.gesture.onPointerUp(event.pointerId);
    }
    if (event.pointerId !== this.panPointer) {
      return;
    }
    this.panPointer = null;
    this.canvas.nativeElement.releasePointerCapture(event.pointerId);
    if (this.panned || !this.clickEligible) {
      return;
    }
    const component = this.componentAt(this.gridPosition(event));
    if (component) {
      this.inspection().activate(component);
    }
  }

  protected onPointerCancel(event: PointerEvent): void {
    if (event.pointerType === 'touch') {
      this.gesture.onPointerUp(event.pointerId);
    }
    if (event.pointerId !== this.panPointer) {
      return;
    }
    this.panPointer = null;
    this.canvas.nativeElement.releasePointerCapture(event.pointerId);
  }

  protected onWheel(event: WheelEvent): void {
    event.preventDefault();
    const center = this.pointerPosition(event);
    if (event.deltaY > 0) {
      this.project.zoomOut(center);
    } else if (event.deltaY < 0) {
      this.project.zoomIn(center);
    }
  }

  /** Swaps the view to a level: ticker rewire, sizing, one-time fit. */
  private showLevel(level: WatchLevel): void {
    this.tickerSub?.unsubscribe();
    // Fires on zoom and theme re-tints — anything that changed the project
    // without an engine snapshot. Panning renders directly (see pan()).
    this.tickerSub = level.session.project.ticker$.subscribe(() =>
      this.render()
    );
    this.syncViewportSize();
    if (level.needsFit) {
      level.needsFit = false;
      this.fitToContent();
    }
    this.render();
  }

  /**
   * Pans and re-blits directly: unlike the zooms, `Project.pan` emits no
   * ticker event (the board pans with its ticker already running).
   */
  private pan(delta: Point): void {
    this.project.pan(delta);
    this.render();
  }

  /** Pointer position in canvas-local CSS pixels (the viewport's space). */
  private pointerPosition(event: MouseEvent): Point {
    const rect = this.canvas.nativeElement.getBoundingClientRect();
    return new Point(event.clientX - rect.left, event.clientY - rect.top);
  }

  /** Pointer position in the watch project's grid coordinates. */
  private gridPosition(event: MouseEvent): Point {
    const local = this.pointerPosition(event);
    const project = this.project;
    const factor = project.scale.x * environment.gridSize;
    return new Point(
      (local.x - project.position.x) / factor,
      (local.y - project.position.y) / factor
    );
  }

  /** The component whose body contains the grid-space point, if any. */
  private componentAt(gridPoint: Point): CircuitComponent | null {
    const queryRect = new Rectangle(gridPoint.x - 0.5, gridPoint.y - 0.5, 1, 1);
    for (const component of this.project.queryComponentsInRange(queryRect)) {
      if (component.bodyGridBounds.contains(gridPoint.x, gridPoint.y)) {
        return component;
      }
    }
    return null;
  }

  /**
   * Sizes the project viewport to the canvas's CSS box. The backing store is
   * owned by the watch renderer's cached CanvasSource and resized per render.
   */
  private syncViewportSize(): void {
    const rect = this.canvas.nativeElement.getBoundingClientRect();
    this.project.resizeViewport(
      Math.max(1, Math.round(rect.width)),
      Math.max(1, Math.round(rect.height))
    );
  }

  /** Centers the content at a zoom that fits it, capped at 100%. */
  private fitToContent(): void {
    const project = this.project;
    const bounds = project.getContentBounds();
    const { width, height } = this.canvas.nativeElement.getBoundingClientRect();
    if (!bounds || width <= 0 || height <= 0) {
      return;
    }
    const gs = environment.gridSize;
    const marginPx = 24;
    const target = Math.min(
      1,
      (width - 2 * marginPx) / (bounds.width * gs),
      (height - 2 * marginPx) / (bounds.height * gs)
    );
    // zoomBy clamps onto the zoom ladder and re-tunes line weights.
    project.zoomBy(target / project.scale.x);
    const scale = project.scale.x;
    project.setPosition(
      new Point(
        width / 2 - (bounds.x + bounds.width / 2) * gs * scale,
        height / 2 - (bounds.y + bounds.height / 2) * gs * scale
      )
    );
  }

  private render(): void {
    if (this.destroyed || !this.lease) {
      return;
    }
    this.lease.render(this.project, this.canvas.nativeElement);
  }
}
