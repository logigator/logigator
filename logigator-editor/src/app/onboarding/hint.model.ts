import { type LgOverlaySide } from '@logigator/ui';
import { WorkMode } from '../work-mode/work-mode.enum';
import { DocPageId } from '@logigator/docs';
import { StepText } from './tutorial.model';
import { OnboardingPlatform } from './onboarding.service';

/** What makes a hint fire, on its first occurrence only. */
export type HintTrigger =
  | { readonly kind: 'workMode'; readonly mode: WorkMode }
  | { readonly kind: 'compactEmpty' }
  | { readonly kind: 'select' }
  | { readonly kind: 'paste' }
  | { readonly kind: 'componentEditor' };

/**
 * A just-in-time hint: a small dismissible popover, shown once the first time
 * its trigger fires, teaching something the flagship tutorial does not cover.
 */
export interface Hint {
  readonly id: string;
  readonly trigger: HintTrigger;
  readonly text: StepText;
  /** Onboarding target id of the anchor per platform; omit to float it. */
  readonly target?: Partial<Record<OnboardingPlatform, string>>;
  /** Side of the anchor to sit on, per platform. A declared side is pinned. */
  readonly side?: Partial<Record<OnboardingPlatform, LgOverlaySide>>;
  /** Documentation page behind the hint's "learn more" link; omit for none. */
  readonly docsPage?: DocPageId;
  readonly platforms?: readonly OnboardingPlatform[];
  /** Suppress once this tutorial is complete; it taught the same thing. */
  readonly suppressIfCompleted?: string;
}
