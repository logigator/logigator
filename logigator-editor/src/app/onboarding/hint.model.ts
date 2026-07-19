import { WorkMode } from '../work-mode/work-mode.enum';
import { DocPageId } from '../documentation/docs-pages';
import { StepText } from './tutorial.model';
import { OnboardingPlatform } from './onboarding.service';

/**
 * What makes a hint fire (its first occurrence only). All reuse streams the
 * editor already exposes: the work-mode signal, the inspection-open signal, and
 * the compact breakpoint.
 */
export type HintTrigger =
  | { readonly kind: 'workMode'; readonly mode: WorkMode }
  | { readonly kind: 'inspect' }
  | { readonly kind: 'compactEmpty' }
  | { readonly kind: 'select' }
  | { readonly kind: 'paste' };

/**
 * A just-in-time hint: shown once, the first time its trigger fires, as a small
 * dismissible popover. Teaches a non-obvious behaviour the flagship tutorial
 * doesn't cover.
 */
export interface Hint {
  readonly id: string;
  readonly trigger: HintTrigger;
  readonly text: StepText;
  /** Onboarding target id of the anchor per platform; omit to float it. */
  readonly target?: Partial<Record<OnboardingPlatform, string>>;
  /** Documentation page behind the hint's "learn more" link; omit for none. */
  readonly docsPage?: DocPageId;
  readonly platforms?: readonly OnboardingPlatform[];
  /** Suppress if this tutorial was already completed (it taught the same thing). */
  readonly suppressIfCompleted?: string;
}
