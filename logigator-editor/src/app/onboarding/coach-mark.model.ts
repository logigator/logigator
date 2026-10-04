/** Where a coach-mark bubble sits relative to its target (center = no target). */
export type CoachMarkPlacement = 'top' | 'right' | 'bottom' | 'left' | 'center';

/**
 * What the bubble needs to render one step, already resolved for the active
 * platform and translated. The bubble itself knows nothing about tutorials.
 */
export interface CoachMarkView {
  /** Translated heading. */
  readonly title: string;
  /** Translated body; may contain simple inline markup (e.g. `<strong>`). */
  readonly text: string;
  /** 1-based position of this step within the tutorial. */
  readonly stepNumber: number;
  readonly totalSteps: number;
  /** Show the Next button — manual steps that do not auto-advance. */
  readonly showNext: boolean;
  /** The last step: the Next button becomes "Finish" and Skip is hidden. */
  readonly isFinal: boolean;
  readonly placement: CoachMarkPlacement;
}

/** Callbacks the bubble invokes; Next only renders on manual steps. */
export interface CoachMarkHandlers {
  readonly next: () => void;
  readonly skip: () => void;
}
