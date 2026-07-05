import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { Point } from 'pixi.js';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Project } from '../../project/project';
import type { SubCircuitWatch } from '../../components/custom/sub-circuit-watch';
import {
  WatchRendererLease,
  WatchRendererService
} from './watch-renderer.service';

/**
 * Renderer for {@link SubCircuitWatch}: a canvas blitted through the shared
 * watch renderer, showing the session's headless project. Fits the content on
 * open, then pans/zooms through the project's own viewport controller —
 * pointer handling is plain DOM (the watch renderer has no event system on
 * its target canvases). Re-blits on engine changes (`render$`), viewport/theme
 * changes (the project's `ticker$`), and host resizes.
 */
@Component({
  selector: 'app-sub-circuit-watch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
  template: `<canvas
    #canvas
    class="block h-full w-full touch-none"
    (pointerdown)="onPointerDown($event)"
    (pointermove)="onPointerMove($event)"
    (pointerup)="onPointerUp($event)"
    (pointercancel)="onPointerUp($event)"
    (wheel)="onWheel($event)"
  ></canvas>`
})
export class SubCircuitWatchComponent implements AfterViewInit, OnDestroy {
  public readonly inspection = input.required<SubCircuitWatch>();

  private readonly watchRenderer = inject(WatchRendererService);
  private readonly hostEl = inject(ElementRef<HTMLElement>);

  @ViewChild('canvas', { static: true })
  private readonly canvas!: ElementRef<HTMLCanvasElement>;

  private lease: WatchRendererLease | null = null;
  private destroyed = false;
  private resizeObserver: ResizeObserver | null = null;
  private readonly subs = new Subscription();

  private panPointer: number | null = null;
  private panLast = { x: 0, y: 0 };

  private get project(): Project {
    return this.inspection().session.project;
  }

  async ngAfterViewInit(): Promise<void> {
    this.syncViewportSize();
    this.fitToContent();

    this.subs.add(this.inspection().render$.subscribe(() => this.render()));
    // Fires on pan/zoom (viewport controller) and theme re-tints — anything
    // that changed the project without an engine snapshot.
    this.subs.add(this.project.ticker$.subscribe(() => this.render()));

    this.resizeObserver = new ResizeObserver(() => {
      this.syncViewportSize();
      this.render();
    });
    this.resizeObserver.observe(this.hostEl.nativeElement);

    this.lease = await this.watchRenderer.acquire();
    if (this.destroyed) {
      this.lease.release();
      this.lease = null;
      return;
    }
    this.render();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.subs.unsubscribe();
    this.resizeObserver?.disconnect();
    this.lease?.release();
    this.lease = null;
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || this.panPointer !== null) {
      return;
    }
    this.panPointer = event.pointerId;
    this.panLast = { x: event.clientX, y: event.clientY };
    this.canvas.nativeElement.setPointerCapture(event.pointerId);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== this.panPointer) {
      return;
    }
    const delta = new Point(
      event.clientX - this.panLast.x,
      event.clientY - this.panLast.y
    );
    this.panLast = { x: event.clientX, y: event.clientY };
    this.project.pan(delta);
  }

  protected onPointerUp(event: PointerEvent): void {
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

  /** Pointer position in canvas-local CSS pixels (the viewport's space). */
  private pointerPosition(event: MouseEvent): Point {
    const rect = this.canvas.nativeElement.getBoundingClientRect();
    return new Point(event.clientX - rect.left, event.clientY - rect.top);
  }

  /** Sizes the canvas backing store (DPR) and the project viewport (CSS px). */
  private syncViewportSize(): void {
    const canvas = this.canvas.nativeElement;
    const rect = this.hostEl.nativeElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    this.project.resizeViewport(width, height);
  }

  /** Centers the content at a zoom that fits it, capped at 100%. */
  private fitToContent(): void {
    const project = this.project;
    const bounds = project.getContentBounds();
    const { width, height } = this.hostEl.nativeElement.getBoundingClientRect();
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
    if (this.destroyed) {
      return;
    }
    this.lease?.render(this.project, this.canvas.nativeElement);
  }
}
