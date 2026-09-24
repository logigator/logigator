import { Point } from 'pixi.js';
import { Project } from '../../project/project';
import { MultiTouchGesture } from '../multi-touch-gesture';
import { canvasToGrid, PointerInput } from './pointer-input';
import {
  isPinch,
  looksLikeTrackpad,
  WHEEL_ZOOM_PER_PX,
  WheelEventLike,
  wheelPixels
} from './wheel-input';

/**
 * The subset of `PointerEvent`/`WheelEvent` the controller reads, so specs can
 * drive the handlers with plain objects.
 */
export interface PointerEventLike {
  pointerId: number;
  pointerType: string;
  button: number;
  clientX: number;
  clientY: number;
  /** `PointerEvent.timeStamp` — the clock the click count is measured on. */
  timeStamp: number;
}

/** Time window (ms) and screen-space slop (canvas-local CSS px) within which a
 *  primary press continues the previous one into a click run. */
const DOUBLE_CLICK_MS = 500;
const DOUBLE_CLICK_SLOP = 6;

// Wheel events closer together than this belong to one scroll or pinch, and
// keep the device their burst was read as: a trackpad's momentum tail and the
// events of a swipe arrive every frame, a mouse's separate notches further
// apart when scrolled slowly.
const WHEEL_BURST_GAP_MS = 150;
// Zoom factor per pixel of trackpad pinch: `e^(-delta · k)`, so the zoom
// follows the fingers continuously. A pinch's deltas are small (see isPinch),
// so one event zooms by at most e^0.5.
const PINCH_ZOOM_PER_PX = 0.01;

/** Middle and right: the two buttons a press pans with, whatever the tool. */
const MIDDLE_BUTTON = 1;
const RIGHT_BUTTON = 2;

export type { WheelEventLike } from './wheel-input';

/** Viewport navigation the controller drives (middle/right-drag pan, wheel
 *  zoom, two-finger pan/pinch). Deltas and centers are canvas-local CSS px. */
export interface PointerNavTarget {
  pan(delta: Point): void;
  /** Pans outside any gesture — a two-finger trackpad scroll — and requests
   *  its own frame, since no gesture holds the ticker on. */
  scroll(delta: Point): void;
  zoomIn(center: Point): void;
  zoomOut(center: Point): void;
  zoomBy(factor: number, center: Point): void;
  /** Continuous-render toggle around drag pans and touch gestures. */
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
   *  dropped while it is absent or destroyed. */
  project: () => Project | null;
  nav: PointerNavTarget;
  tool: PointerToolTarget;
  /** Per-move grid cursor position (own clone — safe to retain). */
  onCursorMove?: (grid: Point) => void;
}

/**
 * Normalizes DOM pointer input on a canvas into tool/navigation streams — the
 * single input path for the board and every watch canvas, since PixiJS's own
 * event system is disabled.
 *
 * - Primary button: captured, streamed to the tool target from down to up.
 *   Click-vs-drag semantics live in the sessions.
 * - Middle and right button: pan-only drag by successive position deltas; the
 *   canvas context menu and the middle press's autoscroll are suppressed.
 * - Touch: pointers feed the {@link MultiTouchGesture} first; a second finger
 *   hands it navigation and cancels the tool stream, so a finger never both
 *   operates a tool and navigates.
 * - Wheel: zoom anchored at the cursor, non-passive so page scroll/zoom is
 *   suppressed over the canvas.
 *
 * Pointer capture keeps move/up flowing when a drag leaves the canvas.
 * Handlers are public so specs can drive them without DOM events.
 */
export class PointerController {
  private readonly _abort = new AbortController();
  private readonly _gesture: MultiTouchGesture;

  private _toolPointer: number | null = null;
  // The current wheel burst: when its last event arrived, and whether it has
  // shown itself to come from a trackpad.
  private _wheelLast = -Infinity;
  private _wheelTrackpad = false;
  private _panPointer: number | null = null;
  private readonly _panLast = new Point();

  // Click counting, the DOM's rule (see PointerInput.clickCount): a primary
  // press within the window and slop of the previous one continues its run.
  private _clickCount = 0;
  private _lastDownTime = 0;
  private readonly _lastDownLocal = new Point();

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
    // Chromium and Firefox start autoscroll from the middle press's mousedown,
    // which would keep scrolling the board after the pan ends.
    canvas.addEventListener(
      'mousedown',
      (e) => {
        if (e.button === MIDDLE_BUTTON) e.preventDefault();
      },
      { signal }
    );
  }

  public destroy(): void {
    this._abort.abort();
    this._gesture.reset();
    this._toolPointer = null;
    this._panPointer = null;
  }

  /**
   * The current project, or null when it is destroyed. Re-homing happens from
   * a change-detection effect, so a disposed project stays reachable here for
   * one cycle — and it has no `position`/`scale` left to map pixels through.
   */
  private _project(): Project | null {
    const project = this.opts.project();
    return project && !project.destroyed ? project : null;
  }

  public onPointerDown(e: PointerEventLike): void {
    const project = this._project();
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
      this._countClick(e, local);
      this.opts.tool.down(this._input(e, local, project));
    } else if (e.button === MIDDLE_BUTTON || e.button === RIGHT_BUTTON) {
      this._panPointer = e.pointerId;
      this._panLast.copyFrom(local);
      this._capture(e.pointerId);
      this.opts.nav.setActive(true);
    }
  }

  public onPointerMove(e: PointerEventLike): void {
    const project = this._project();
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
    const project = this._project();
    if (!project) return;
    this.opts.tool.up(this._input(e, this._localPosition(e), project));
  }

  public onPointerCancel(e: PointerEventLike): void {
    if (this._endPointer(e) !== 'tool') return;
    this.opts.tool.cancel();
  }

  /**
   * Ends hover previews. While a pointer is captured this does not fire for
   * the geometric boundary, so an in-flight drag keeps streaming.
   */
  public onPointerLeave(): void {
    this.opts.tool.leave?.();
  }

  /**
   * Teardown for a lifted pointer: feeds the gesture, releases capture, drops
   * ownership. Returns which stream the pointer owned.
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

  /**
   * A mouse wheel zooms continuously; a trackpad pans with two fingers and zooms
   * with a pinch, which browsers deliver as a ctrl-wheel ({@link isPinch}).
   * Whether a scroll came from a trackpad is guessed from its events
   * ({@link looksLikeTrackpad}) and held for the rest of the burst, so a swipe
   * that starts out looking like a wheel turns into a pan rather than flipping
   * back and forth.
   */
  public onWheel(e: WheelEventLike): void {
    e.preventDefault();
    if (!this._project()) return;
    const now = e.timeStamp ?? performance.now();
    if (now - this._wheelLast > WHEEL_BURST_GAP_MS) this._wheelTrackpad = false;
    this._wheelLast = now;
    if (looksLikeTrackpad(e)) this._wheelTrackpad = true;

    const center = this._localPosition(e);
    if (isPinch(e)) {
      this.opts.nav.zoomBy(Math.exp(-e.deltaY * PINCH_ZOOM_PER_PX), center);
      return;
    }
    if (this._wheelTrackpad && !e.ctrlKey) {
      this.opts.nav.scroll(
        new Point(-wheelPixels(e, e.deltaX ?? 0), -wheelPixels(e, e.deltaY))
      );
      return;
    }

    if (e.deltaY === 0) return;
    // Continuous, proportional to the delta: a notch is one zoom-button step,
    // input merged into one event zooms by all of it, and a high-resolution
    // wheel zooms smoothly. The zoom buttons keep their ladder; `zoomBy`
    // resyncs it so a button press continues from here.
    this.opts.nav.zoomBy(
      Math.exp(-wheelPixels(e, e.deltaY) * WHEEL_ZOOM_PER_PX),
      center
    );
  }

  /** Cancels the tool stream once the gesture owns navigation, so the pressed
   *  finger cannot commit a tool action. */
  private _cancelTool(): void {
    if (this._toolPointer === null) return;
    this._toolPointer = null;
    this.opts.tool.cancel();
  }

  private _localPosition(e: { clientX: number; clientY: number }): Point {
    const rect = this.opts.canvas.getBoundingClientRect();
    return new Point(e.clientX - rect.left, e.clientY - rect.top);
  }

  /**
   * Advances the click run for a primary press: one within the window and slop
   * of the previous press carries the run on, anything else starts a new one.
   */
  private _countClick(e: PointerEventLike, local: Point): void {
    const dx = local.x - this._lastDownLocal.x;
    const dy = local.y - this._lastDownLocal.y;
    // A run cannot start before the first press, so the anchor means nothing
    // until `_clickCount` has been set at least once.
    const continues =
      this._clickCount > 0 &&
      e.timeStamp - this._lastDownTime <= DOUBLE_CLICK_MS &&
      dx * dx + dy * dy <= DOUBLE_CLICK_SLOP * DOUBLE_CLICK_SLOP;

    this._clickCount = continues ? this._clickCount + 1 : 1;
    this._lastDownTime = e.timeStamp;
    // The very same point travels on as `input.global`, which receivers are
    // free to mutate — keep the anchor out of their reach.
    this._lastDownLocal.copyFrom(local);
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
      grid: canvasToGrid(project, local),
      clickCount: this._clickCount
    };
  }

  private _capture(pointerId: number): void {
    // The pointer may already be gone (a pen leaving the digitizer between
    // down and capture); losing capture only degrades off-canvas tracking.
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
