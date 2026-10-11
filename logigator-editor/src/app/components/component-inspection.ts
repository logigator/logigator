import { Signal, Type } from '@angular/core';

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
 * Where an inspection sends the presses it is played with, so it never
 * resolves an engine unit itself: the top-level board's user-input stream, or
 * the watch level its component is a copy in. `slot` is the user input's
 * slot.
 */
export interface InputRoute {
  press(slot: number): void;
  release(slot: number): void;
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
