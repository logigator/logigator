import { Point } from 'pixi.js';
import { Project } from '../../project/project';
import { MultiTouchGesture } from '../multi-touch-gesture';
import { canvasToGrid, PointerInput } from './pointer-input';

/**
 * The DOM event surface the controller consumes — the subset of
 * `PointerEvent`/`WheelEvent` it reads, so specs can drive the handlers with
 * plain objects.
 */
export interface PointerEventLike {
  pointerId: number;
  pointerType: string;
  button: number;
  clientX: number;
  clientY: number;
}

export interface WheelEventLike {
  clientX: number;
  clientY: number;
  deltaY: number;
  preventDefault(): void;
}

/** Viewport navigation the controller drives (right-drag pan, wheel zoom,
 *  two-finger pan/pinch). Deltas and centers are canvas-local CSS pixels. */
export interface PointerNavTarget {
  pan(delta: Point): void;
  zoomIn(center: Point): void;
  zoomOut(center: Point): void;
  zoomBy(factor: number, center: Point): void;
  /** Continuous-render toggle around right-drag pans and touch gestures. */
  setActive(active: boolean): void;
}

/** The primary-button (tool) stream: one pointer owns it from down to up. */
export interface PointerToolTarget {
  down(input: PointerInput): void;
  move(input: PointerInput): void;
  up(input: PointerInput): void;
  cancel(): void;
  /** Moves while no pointer is pressed (e.g. the negation-mode port preview). */
  hover?(input: PointerInput): void;
  /** The pointer left the canvas — hover previews stop applying. */
  leave?(): void;
}

export interface PointerControllerOptions {
  canvas: HTMLCanvasElement;
  /** The project whose viewport maps canvas pixels to grid space. Events are
   *  dropped while it is `null`. */
  project: () => Project | null;
  nav: PointerNavTarget;
  tool: PointerToolTarget;
  /** Per-move grid cursor position (own clone — safe to retain). */
  onCursorMove?: (grid: Point) => void;
}

/**
 * Normalizes DOM pointer input on a canvas into tool/navigation streams —
 * the single input path for the board and every watch canvas (the shared
 * watch renderer has no event system on its target canvases, and the board
 * disables PixiJS's via `eventFeatures`).
 *
 * - Primary button: captured, streamed to the tool target from down to up.
 *   Click-vs-drag semantics live in the sessions (see `PanSession`).
 * - Right button: pan-only drag by successive position deltas; the canvas
 *   context menu is suppressed outright (there is no circuit context menu).
 * - Touch: pointers feed the {@link MultiTouchGesture} first; when a second
 *   finger lands the gesture takes over and the tool stream is cancelled, so
 *   a finger never both operates a tool and navigates.
 * - Wheel: zoom anchored at the cursor (non-passive, so page scroll/zoom is
 *   suppressed over the canvas).
 *
 * Pointer capture keeps move/up flowing when a drag leaves the canvas.
 * Handlers are public so specs can drive them without synthesizing DOM
 * events; `destroy()` detaches all listeners.
 */
export class PointerController {
  private readonly _abort = new AbortController();
  private readonly _gesture: MultiTouchGesture;

  private _toolPointer: number | null = null;
  private _panPointer: number | null = null;
  private readonly _panLast = new Point();

  constructor(private readonly opts: PointerControllerOptions) {
    this._gesture = new MultiTouchGesture({
      pan: (delta) => opts.nav.pan(delta),
      zoomBy: (factor, center) => opts.nav.zoomBy(factor, center),
      abortActiveDrag: () => this._cancelTool(),
      setActive: (active) => opts.nav.setActive(active)
    });

    const canvas = opts.canvas;
    const signal = this._abort.signal;
    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e), {
      signal
    });
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e), {
      signal
    });
    canvas.addEventListener('pointerup', (e) => this.onPointerUp(e), {
      signal
    });
    canvas.addEventListener('pointercancel', (e) => this.onPointerCancel(e), {
      signal
    });
    canvas.addEventListener('pointerleave', () => this.onPointerLeave(), {
      signal
    });
    // Non-passive: preventDefault must stop the page from scrolling/zooming.
    canvas.addEventListener('wheel', (e) => this.onWheel(e), {
      signal,
      passive: false
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault(), {
      signal
    });
  }

  public destroy(): void {
    this._abort.abort();
    this._gesture.reset();
    this._toolPointer = null;
    this._panPointer = null;
  }

  public onPointerDown(e: PointerEventLike): void {
    const project = this.opts.project();
    if (!project) return;
    const local = this._localPosition(e);
    if (e.pointerType === 'touch') {
      this._gesture.onPointerDown(e.pointerId, local.x, local.y);
      if (this._gesture.isActive) return;
    }
    // One interaction at a time: extra buttons/pointers don't stack drags.
    if (this._toolPointer !== null || this._panPointer !== null) return;

    if (e.button === 0) {
      this._toolPointer = e.pointerId;
      this._capture(e.pointerId);
      this.opts.tool.down(this._input(e, local, project));
    } else if (e.button === 2) {
      this._panPointer = e.pointerId;
      this._panLast.copyFrom(local);
      this._capture(e.pointerId);
      this.opts.nav.setActive(true);
    }
  }

  public onPointerMove(e: PointerEventLike): void {
    const project = this.opts.project();
    if (!project) return;
    const local = this._localPosition(e);
    if (e.pointerType === 'touch') {
      this._gesture.onPointerMove(e.pointerId, local.x, local.y);
      if (this._gesture.isActive) return;
    }
    const input = this._input(e, local, project);
    this.opts.onCursorMove?.(input.grid.clone());
    if (e.pointerId === this._panPointer) {
      this.opts.nav.pan(
        new Point(local.x - this._panLast.x, local.y - this._panLast.y)
      );
      this._panLast.copyFrom(local);
    } else if (e.pointerId === this._toolPointer) {
      this.opts.tool.move(input);
    } else {
      this.opts.tool.hover?.(input);
    }
  }

  public onPointerUp(e: PointerEventLike): void {
    if (this._endPointer(e) !== 'tool') return;
    const project = this.opts.project();
    if (!project) return;
    this.opts.tool.up(this._input(e, this._localPosition(e), project));
  }

  public onPointerCancel(e: PointerEventLike): void {
    if (this._endPointer(e) !== 'tool') return;
    this.opts.tool.cancel();
  }

  /**
   * The pointer left the canvas. While a pointer is captured this doesn't
   * fire for the geometric boundary, so it only ends hover previews — an
   * in-flight drag keeps streaming through move/up.
   */
  public onPointerLeave(): void {
    this.opts.tool.leave?.();
  }

  /**
   * Shared teardown for a lifted pointer (up and cancel): feeds the gesture,
   * releases capture, and drops pan/tool ownership. Returns which stream the
   * pointer owned so the caller can dispatch the final tool call.
   */
  private _endPointer(e: PointerEventLike): 'pan' | 'tool' | null {
    if (e.pointerType === 'touch') {
      this._gesture.onPointerUp(e.pointerId);
    }
    if (e.pointerId === this._panPointer) {
      this._panPointer = null;
      this._release(e.pointerId);
      this.opts.nav.setActive(false);
      return 'pan';
    }
    if (e.pointerId !== this._toolPointer) return null;
    this._toolPointer = null;
    this._release(e.pointerId);
    return 'tool';
  }

  public onWheel(e: WheelEventLike): void {
    e.preventDefault();
    if (!this.opts.project()) return;
    const center = this._localPosition(e);
    if (e.deltaY > 0) {
      this.opts.nav.zoomOut(center);
    } else if (e.deltaY < 0) {
      this.opts.nav.zoomIn(center);
    }
  }

  /** Cancels the tool stream (a second finger landed — the gesture owns
   *  navigation now; the pressed finger must not commit a tool action). */
  private _cancelTool(): void {
    if (this._toolPointer === null) return;
    this._toolPointer = null;
    this.opts.tool.cancel();
  }

  private _localPosition(e: { clientX: number; clientY: number }): Point {
    const rect = this.opts.canvas.getBoundingClientRect();
    return new Point(e.clientX - rect.left, e.clientY - rect.top);
  }

  private _input(
    e: PointerEventLike,
    local: Point,
    project: Project
  ): PointerInput {
    return {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      global: local,
      grid: canvasToGrid(project, local)
    };
  }

  private _capture(pointerId: number): void {
    // The pointer may already be gone (e.g. a pen leaving the digitizer
    // between down and capture) — losing capture only degrades off-canvas
    // tracking, so don't let the exception kill the interaction.
    try {
      this.opts.canvas.setPointerCapture(pointerId);
    } catch {
      /* empty */
    }
  }

  private _release(pointerId: number): void {
    try {
      this.opts.canvas.releasePointerCapture(pointerId);
    } catch {
      /* empty */
    }
  }
}
