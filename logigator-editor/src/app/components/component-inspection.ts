import { Signal, Type } from '@angular/core';
import type { UserInputPhase } from '../project/project';

/** Size hints (px) for the desktop inspection window hosting the renderer. */
export interface ComponentInspectionSizing {
  initial?: { width: number; height: number };
  min?: { width: number; height: number };
  max?: { width: number; height: number };
}

/** One segment of a structured inspection title (a breadcrumb level). */
export interface InspectionTitlePart {
  label: string;
  /** Present on ancestor segments — navigates back to that level. */
  navigate?: () => void;
}

/**
 * One timed step of an input's outputs, the engine's own frame: the engine
 * queues an input's frames and applies them in order inside its ticks. A
 * frame is on the outputs and their wires after the tick it is applied in,
 * and the first one sent to an idle input is applied by the next tick.
 *
 * - `state` has one entry per output port, in port order: `true` and `false`
 *   drive the port, `null` keeps what it shows when the frame is applied.
 * - `hold` is how many ticks, at least, the frame stays before the input's
 *   next frame replaces it; 1 when absent. The last frame stays.
 * - `coalesce` says what the frame reports. Absent, it is an **event**, a
 *   press or a release: never dropped or merged, so it reaches the circuit
 *   however fast the next one follows, and {@link InputRoute.pending} counts
 *   it until it is applied. `true` is a **state**, a position: it merges into
 *   the input's last frame not yet applied while that one is a state too
 *   (its non-`null` entries over the earlier ones), so a state changed twice
 *   between two ticks reaches the circuit once, as its final value. A merge
 *   never reaches an applied frame or passes a queued event.
 */
export interface InputFrame {
  readonly state: readonly (boolean | null)[];
  readonly hold?: number;
  readonly coalesce?: boolean;
}

/**
 * The most event frames one input holds pending: `@logigator/sim`'s
 * `submitInput` (0.5.0 on) refuses a request that would take an input past
 * it, whole, and queues nothing. States never count, so a release always
 * fits; a cancel replaces what was queued, so only its own events count.
 */
export const INPUT_QUEUE_LIMIT = 65_536;

/** How many of `frames` are events, what {@link INPUT_QUEUE_LIMIT} counts. */
export function eventFrames(frames: readonly InputFrame[]): number {
  let events = 0;
  for (const frame of frames) {
    if (!frame.coalesce) {
      events++;
    }
  }
  return events;
}

/**
 * Whether `frames` fit behind the `pending` event frames an input still
 * has, so the engine takes them. `pending` is an upper bound (see
 * {@link InputRoute.pending}), so a `true` is never refused for room.
 */
export function fitsInputQueue(
  pending: number,
  frames: readonly InputFrame[]
): boolean {
  return pending + eventFrames(frames) <= INPUT_QUEUE_LIMIT;
}

/** One pointer operation on one slot of a user input. */
export interface SlotOperation {
  readonly slot: number;
  readonly phase: UserInputPhase;
}

/**
 * Where an inspection sends what it is played with, so it never resolves an
 * engine unit itself: the top-level board, or the watch level its component
 * is a copy in. `operate` operates slots of a user input through its
 * gesture, every slot one call changes going out in **one** frame, so
 * controls pressed together reach the circuit on the same tick; `send`
 * queues frames on the component's input
 * directly — refused whole, sending nothing, when they do not fit behind
 * what it still has ({@link fitsInputQueue}) — `cancel` drops the frames it
 * still has queued — ending a hold that is still running — and queues
 * `frames` in their place, the first applied on the next tick, or keeps the
 * outputs as they are without any, and `pending` is how many of its event
 * frames are not yet applied, at most: the count the last snapshot
 * reported, plus every event sent since.
 */
export interface InputRoute {
  operate(operations: readonly SlotOperation[]): void;
  send(frames: readonly InputFrame[]): void;
  cancel(frames?: readonly InputFrame[]): void;
  pending(): number;
}

/** A byte range `[start, end)`. */
export interface ByteRange {
  readonly start: number;
  readonly end: number;
}

/**
 * A live read of one range of a component's engine state — a RAM's memory,
 * in the layout its type documents. The bytes arrive through the callback
 * the watch was started with, as `(offset, bytes)` read beside the snapshot
 * just applied and before the frame's `onFrame`: once after the range is set
 * or moved, then whenever the component's state changed. A stop rebuilds the
 * engine at the board's initial state and reports nothing; the inspection
 * reads it off `SimulationService.resets`.
 */
export interface StateWatch {
  /** The range read from now on; `null` reads nothing until the next one. */
  setRange(range: ByteRange | null): void;
  close(): void;
}

/**
 * Where an inspection reads its component's engine state, so it never
 * resolves an engine unit itself: the top-level board, or the watch level its
 * component is a copy in. `watch` is `null` for a component with no state the
 * session reads.
 */
export interface StateRoute {
  watch(onRead: (offset: number, bytes: Uint8Array) => void): StateWatch | null;
}

/** What an inspection is opened with, beside its component. */
export interface InspectionContext {
  /** The route for the component's own presses, bound where it was opened. */
  readonly input: InputRoute;
  /** The route for its engine state, bound where it was opened. */
  readonly state: StateRoute;
}

/**
 * A live view into a component instance while the simulation runs — the
 * inspection analog of {@link ComponentOption} / {@link ComponentAction}. A
 * config declares one via its `inspection` factory; a presenter (a floating
 * window on desktop, the sheet on compact) then renders `renderer` with the
 * inspection as its `inspection` input.
 *
 * Inspections read main-thread state (options, port power) and expose what the
 * renderer shows as signals, refreshed by `onFrame` after every applied
 * snapshot.
 */
export abstract class ComponentInspection {
  /** Categorical kind, for analytics; never a user-authored label. */
  public abstract readonly kind: string;
  /** Renderer component; receives this inspection as its `inspection` input. */
  public abstract readonly renderer: Type<unknown>;
  /** Live title for the hosting window / sheet tab. */
  public abstract readonly title: Signal<string>;
  /**
   * Breadcrumbs, rendered by the title bar in place of the plain `title`,
   * which stays the flat fallback for sheet tabs and aria labels.
   */
  public readonly titleParts?: Signal<readonly InspectionTitlePart[]>;
  /** Desktop window sizing; the presenter falls back to its defaults. */
  public readonly sizing?: ComponentInspectionSizing;
  /**
   * The shared bottom sheet by default, keeping the canvas visible above it;
   * `fullscreen` for canvas-hosting views that need the space.
   */
  public readonly compactPresentation?: 'sheet' | 'fullscreen';

  /** Refreshes the exposed state; runs after each applied snapshot. */
  public onFrame?(): void;
  /** Releases resources when the inspection closes. */
  public destroy?(): void;
}
