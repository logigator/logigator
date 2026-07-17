import {
  AfterViewInit,
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
import { TranslationService } from '../../translation/translation.service';
import { Point, Rectangle } from 'pixi.js';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Component as CircuitComponent } from '../../components/component';
import { ToastService } from '../../logging/toast.service';
import { PointerController } from '../../rendering/interaction/pointer-controller';
import { PointerInput } from '../../rendering/interaction/pointer-input';
import { PanSession } from '../../rendering/sessions/pan.session';
import { Project } from '../../project/project';
import type {
  SubCircuitWatch,
  WatchLevel
} from '../../components/custom/sub-circuit-watch';
import {
  RendererLease,
  RendererService,
  uncullTree
} from '../../rendering/renderer.service';

/**
 * Renderer for {@link SubCircuitWatch}: a canvas blitted through the shared
 * app renderer, showing the active level's headless project (the breadcrumb
 * trail lives in the hosting header via the inspection's `titleParts`). Fits
 * the content when a level first shows, then pans/zooms through the project's
 * own viewport controller. Input runs through the shared PointerController
 * (right-drag/wheel/pinch navigation); the tool stream is a PanSession whose
 * tap action routes to the model (inner input / drill-down / data inspector).
 * Re-blits on engine changes (`render$`), viewport/theme changes (the
 * project's `ticker$`), and host resizes.
 */
@Component({
  selector: 'app-sub-circuit-watch',
  host: { class: 'block h-full' },
  template: `<canvas #canvas class="block h-full w-full touch-none"></canvas>`
})
export class SubCircuitWatchComponent implements AfterViewInit, OnDestroy {
  public readonly inspection = input.required<SubCircuitWatch>();

  private readonly rendererService = inject(RendererService);
  private readonly injector = inject(Injector);
  private readonly toast = inject(ToastService);
  private readonly translation = inject(TranslationService);

  @ViewChild('canvas', { static: true })
  private readonly canvas!: ElementRef<HTMLCanvasElement>;

  private lease: RendererLease | null = null;
  private destroyed = false;
  private resizeObserver: ResizeObserver | null = null;
  private readonly subs = new Subscription();
  private tickerSub: Subscription | null = null;

  private controller: PointerController | null = null;
  private panSession: PanSession | null = null;

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

    this.controller = new PointerController({
      canvas: this.canvas.nativeElement,
      project: () => this.project,
      // Unlike the zooms (their ticker events re-blit via the ticker
      // subscription below), `Project.pan` emits nothing — render explicitly.
      nav: {
        pan: (delta) => this.pan(delta),
        zoomIn: (center) => this.project.viewport.zoomIn(center),
        zoomOut: (center) => this.project.viewport.zoomOut(center),
        zoomBy: (factor, center) =>
          this.project.viewport.zoomBy(factor, center),
        setActive: () => undefined
      },
      tool: {
        down: (input) => this.startPanOrTap(input),
        move: (input) => {
          this.panSession?.onMove(input);
          this.render();
        },
        up: () => {
          this.panSession?.onEnd();
          this.panSession = null;
        },
        cancel: () => {
          this.panSession?.onCancel();
          this.panSession = null;
        }
      }
    });

    // Tracks breadcrumb navigation: rewires the ticker subscription and the
    // viewport to whichever level is visible.
    effect(
      () => {
        const level = this.inspection().activeLevel();
        untracked(() => this.showLevel(level));
      },
      { injector: this.injector }
    );

    void this.rendererService
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
          this.translation.translate('watch.rendererFailed'),
          'SubCircuitWatchComponent',
          err
        );
      });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.controller?.destroy();
    this.subs.unsubscribe();
    this.tickerSub?.unsubscribe();
    this.resizeObserver?.disconnect();
    this.lease?.release();
    this.lease = null;
  }

  /** Drag-to-pan with tap-to-activate — the watch's only tool. */
  private startPanOrTap(input: PointerInput): void {
    this.panSession = new PanSession(
      this.project,
      input.global,
      input.grid,
      (tap) => {
        const component = this.componentAt(tap);
        if (component) {
          this.inspection().activate(component);
        }
      }
    );
  }

  /** Swaps the view to a level: ticker rewire, sizing, one-time fit. */
  private showLevel(level: WatchLevel): void {
    // A drag never survives a level swap — the session holds the old project.
    this.panSession?.onCancel();
    this.panSession = null;
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
    this.project.viewport.pan(delta);
    this.render();
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
    this.project.viewport.resizeViewport(
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
    project.viewport.zoomBy(target / project.scale.x);
    const scale = project.scale.x;
    project.viewport.setPosition(
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
    // No cull pass runs on watch renders — force the subtree visible so stale
    // `culled` bits can't hide content.
    uncullTree(this.project);
    this.lease.render(this.project, this.canvas.nativeElement);
  }
}
