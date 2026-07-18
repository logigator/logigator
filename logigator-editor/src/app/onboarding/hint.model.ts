import { WorkMode } from '../work-mode/work-mode.enum';
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
  | { readonly kind: 'compactEmpty' };

/**
 * A just-in-time hint: shown once, the first time its trigger fires, as a small
 * dismissible popover. Teaches a non-obvious behaviour the flagship tutorial
 * doesn't cover.
 */
export interface Hint {
  readonly id: string;
  readonly trigger: HintTrigger;
  readonly text: StepText;
  readonly target?: Partial<Record<OnboardingPlatform, string>>;
  readonly platforms?: readonly OnboardingPlatform[];
  /** Suppress if this tutorial was already completed (it taught the same thing). */
  readonly suppressIfCompleted?: string;
}
