import { WorkMode } from '../work-mode/work-mode.enum';
import { Project } from '../project/project';
import { SimulationService } from '../simulation/simulation.service';
import { TranslationKey } from '../translation/translation-key.model';
import { CoachMarkPlacement } from './coach-mark.model';
import { OnboardingPlatform } from './onboarding.service';

/**
 * What a step's completion predicate sees. Predicates compare live state
 * against `baseline`, the counts captured when the step started, so any path to
 * the goal advances — a different order, extra parts or a self-corrected
 * mistake all still clear an absolute threshold over the baseline.
 */
export interface TutorialContext {
  readonly project: Project;
  readonly sim: SimulationService;
  /** Component count by type id, captured at step entry. */
  readonly baseline: ReadonlyMap<number, number>;
  /** Set once the user drives a lever or button during the step. */
  readonly userInteracted: boolean;
}

export type TutorialPredicate = (ctx: TutorialContext) => boolean;

/**
 * When a step auto-completes. `action`/`simFrame`/`userInput` wake on the
 * matching editor stream and test their predicate against project state —
 * a state diff, not a gesture match, so the interaction model stays tolerant.
 */
export type AdvanceOn =
  | { readonly kind: 'manual' }
  | { readonly kind: 'workMode'; readonly mode: WorkMode }
  | { readonly kind: 'action'; readonly predicate: TutorialPredicate }
  | { readonly kind: 'simFrame'; readonly predicate?: TutorialPredicate }
  | { readonly kind: 'userInput'; readonly predicate?: TutorialPredicate };

/** Body text: one key, or a per-platform key — gesture wording differs. */
export type StepText =
  TranslationKey | Partial<Record<OnboardingPlatform, TranslationKey>>;

/** The key `text` resolves to on `platform`, falling back desktop → compact. */
export function resolveStepText(
  text: StepText,
  platform: OnboardingPlatform
): TranslationKey {
  if (typeof text === 'string') return text;
  return (text[platform] ?? text.desktop ?? text.compact) as TranslationKey;
}

export interface TutorialStep {
  readonly id: string;
  readonly title: TranslationKey;
  readonly text: StepText;
  /** Platforms this step applies to; omit for all. */
  readonly platforms?: readonly OnboardingPlatform[];
  /**
   * Onboarding target id of the anchor per platform; omit a platform to centre
   * there. Several candidate ids may be listed in priority order — the first
   * registered one wins, so a step can follow an element that moves between
   * hosts, such as a palette item that is only in the DOM while its sheet is
   * open.
   */
  readonly target?: Partial<
    Record<OnboardingPlatform, string | readonly string[]>
  >;
  /** Bubble placement, one side or per-platform. Omit to auto-pick. */
  readonly placement?:
    | CoachMarkPlacement
    | Partial<Record<OnboardingPlatform, CoachMarkPlacement>>;
  readonly advanceOn: AdvanceOn;
  /** Interpolation params for `text` (e.g. a "1 of 2 placed" sub-count). */
  readonly params?: (ctx: TutorialContext) => Record<string, unknown>;
  /** Advisory "not quite" text for an off-script action; never blocks. */
  readonly nudge?: (ctx: TutorialContext) => TranslationKey | null;
}

export interface TutorialDefinition {
  readonly id: string;
  readonly steps: readonly TutorialStep[];
}
