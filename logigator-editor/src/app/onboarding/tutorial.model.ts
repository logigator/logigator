import { WorkMode } from '../work-mode/work-mode.enum';
import { Project } from '../project/project';
import { SimulationService } from '../simulation/simulation.service';
import { TranslationKey } from '../translation/translation-key.model';
import { CoachMarkPlacement } from './coach-mark.model';
import { OnboardingPlatform } from './onboarding.service';

/**
 * What a step's completion predicate sees. Predicates read the live project (and
 * simulation) and compare against `baseline` — the component counts captured
 * when the step started — so any path to the goal advances: a different order,
 * extra parts, or a self-corrected mistake all still satisfy an absolute
 * threshold over the baseline. `userInteracted` is set once the user drives a
 * lever/button during the step (for the "flip a switch" step).
 */
export interface TutorialContext {
  readonly project: Project;
  readonly sim: SimulationService;
  /** Component count by {@link ComponentType}, captured at step entry. */
  readonly baseline: ReadonlyMap<number, number>;
  readonly userInteracted: boolean;
}

export type TutorialPredicate = (ctx: TutorialContext) => boolean;

/**
 * When a step auto-completes. `action`/`simFrame`/`userInput` wake on the
 * matching editor stream and then test their predicate against project state
 * (state-diff, not gesture-match — the interaction model is tolerant);
 * `workMode` completes on entering a mode; `manual` waits for the Next button.
 */
export type AdvanceOn =
  | { readonly kind: 'manual' }
  | { readonly kind: 'workMode'; readonly mode: WorkMode }
  | { readonly kind: 'action'; readonly predicate: TutorialPredicate }
  | { readonly kind: 'simFrame'; readonly predicate?: TutorialPredicate }
  | { readonly kind: 'userInput'; readonly predicate?: TutorialPredicate };

/** Body text: one key, or a per-platform key (tap/drag/pinch wording differs). */
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
   * Onboarding target id of the anchor per platform; omit a platform to center
   * there. A platform may list several candidate ids in priority order — the
   * first one currently registered wins, so a step can follow an element that
   * moves between hosts (e.g. compact: anchor the palette item while its sheet
   * is open, else fall back to the button that opens the sheet).
   */
  readonly target?: Partial<
    Record<OnboardingPlatform, string | readonly string[]>
  >;
  /** Bubble placement; a single side, or per-platform (the anchor can sit at
   *  opposite screen edges across breakpoints). Omit to auto-pick per target. */
  readonly placement?:
    | CoachMarkPlacement
    | Partial<Record<OnboardingPlatform, CoachMarkPlacement>>;
  readonly advanceOn: AdvanceOn;
  /** Interpolation params for `text` (e.g. a "1 of 2 placed" sub-count). */
  readonly params?: (ctx: TutorialContext) => Record<string, unknown>;
  /** Advisory "not quite" text shown on a clearly off-script action; never blocks. */
  readonly nudge?: (ctx: TutorialContext) => TranslationKey | null;
}

export interface TutorialDefinition {
  readonly id: string;
  readonly steps: readonly TutorialStep[];
}
