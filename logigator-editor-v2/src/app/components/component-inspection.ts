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
 * A live view into a component instance while the simulation runs — the
 * inspection analog of {@link ComponentOption} / {@link ComponentAction}. A
 * config declares one via its `inspection` factory; tapping the component in
 * simulation mode then creates an instance and hands it to a presenter (a
 * floating window on desktop, the inspection sheet on compact), which renders
 * `renderer` with the inspection itself as its `inspection` input.
 *
 * Inspections read main-thread state (the component's options, its port power)
 * and expose what the renderer shows as signals; {@link InspectionService}
 * calls `onFrame` after every applied simulation snapshot so those signals
 * track the running engine.
 */
export abstract class ComponentInspection {
  /** Renderer component; receives this inspection as its `inspection` input. */
  public abstract readonly renderer: Type<unknown>;
  /** Live title for the hosting window / sheet tab. */
  public abstract readonly title: Signal<string>;
  /**
   * Structured title segments (breadcrumbs). When present, the window title
   * bar renders these instead of the plain `title` — ancestor segments are
   * clickable and navigate back. `title` stays the flat fallback (sheet
   * tabs, aria labels).
   */
  public readonly titleParts?: Signal<readonly InspectionTitlePart[]>;
  /** Desktop window sizing; the presenter falls back to its defaults. */
  public readonly sizing?: ComponentInspectionSizing;
  /**
   * How the inspection presents on compact: the shared bottom sheet
   * (default — the canvas stays visible above it) or a fullscreen window
   * with a back button (canvas-hosting views that need the space).
   */
  public readonly compactPresentation?: 'sheet' | 'fullscreen';

  /** Refreshes the exposed state; runs after each applied snapshot. */
  public onFrame?(): void;
  /** Releases resources when the inspection closes. */
  public destroy?(): void;
}
