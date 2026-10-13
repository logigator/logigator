import { Signal, Type } from '@angular/core';
import { UserInputDrive } from './user-input';

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
 * One write to a slot of an input: output port `slot`, driven as `drive`
 * says. A `level` write sets the slot to `value`; a `pulse` write pulses it
 * for one tick on `true`, and `false` writes nothing.
 */
export interface SlotWrite {
  slot: number;
  drive: UserInputDrive;
  value: boolean;
}

/**
 * Slot writes the engine receives at one tick boundary, with no tick between
 * them. An input reports either events or a state: an `event` frame queues
 * behind the input's earlier frames and is on the outputs for at least one
 * tick before the next one applies, so a press and its release both reach
 * the circuit however fast they came; a `state` frame merges into the
 * input's last frame while that one is a `state` frame not yet applied, so
 * the next tick sees the final state. `counted` marks a frame
 * {@link InputRoute.pending} counts.
 */
export interface InputFrame {
  kind: 'state' | 'event';
  writes: readonly SlotWrite[];
  counted?: boolean;
}

/**
 * Where an inspection sends what it is played with, so it never resolves an
 * engine unit itself: the top-level board, or the watch level its component
 * is a copy in. `press` and `release` operate one slot of a user input
 * through its gesture; `send` queues frames on the component's units
 * directly, `cancel` drops the frames still queued and applies `reset` at
 * once, and `pending` is how many counted frames are still queued.
 */
export interface InputRoute {
  press(slot: number): void;
  release(slot: number): void;
  send(frames: readonly InputFrame[]): void;
  cancel(reset: InputFrame): void;
  pending(): number;
}

/** What an inspection is opened with, beside its component. */
export interface InspectionContext {
  /** The route for the component's own presses, bound where it was opened. */
  readonly input: InputRoute;
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
