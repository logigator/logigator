import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { LgButton } from '@logigator/ui';
import { ProjectService } from '../project/project.service';
import { WorkModeService } from '../work-mode/work-mode.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import {
  GETTING_STARTED_TUTORIAL,
  OnboardingService
} from './onboarding.service';
import { TutorialRunnerService } from './tutorial-runner.service';
import { TranslateDirective } from '../translation/translate.directive';

/**
 * The single launch path for the getting-started tutorial — there is no
 * auto-start. A soft, dismissible prompt shown once to a first-time user (until
 * dismissed or the tutorial started), regardless of what's on the canvas.
 * Clicking Start hands off to {@link TutorialRunnerService.launch}, which swaps
 * in a fresh empty board (behind a discard-changes confirm) before running the
 * tutorial, and retires the nudge.
 */
@Component({
  selector: 'app-onboarding-nudge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, LgButton],
  template: `
    @if (visible()) {
      <div
        *appTranslate="let t"
        class="pointer-events-auto mx-auto flex w-fit max-w-xl items-center gap-3 rounded-lg border border-border bg-content/95 px-4 py-3 shadow-lg backdrop-blur"
      >
        <span class="text-sm text-muted">{{ t('onboarding.nudge.text') }}</span>
        <lg-button
          size="sm"
          [label]="t('onboarding.nudge.start')"
          (onClick)="start()"
        ></lg-button>
        <lg-button
          size="sm"
          severity="secondary"
          text
          icon="ph ph-x"
          [ariaLabel]="t('onboarding.nudge.dismiss')"
          (onClick)="dismiss()"
        ></lg-button>
      </div>
    }
  `
})
export class OnboardingNudgeComponent {
  private readonly onboarding = inject(OnboardingService);
  private readonly runner = inject(TutorialRunnerService);
  private readonly projectService = inject(ProjectService);
  private readonly workMode = inject(WorkModeService);

  protected readonly visible = computed(
    () =>
      !this.onboarding.nudgeDismissed() &&
      this.onboarding.tipsEnabled() &&
      !this.onboarding.hasCompletedTutorial(GETTING_STARTED_TUTORIAL) &&
      this.onboarding.activeTutorial() === null &&
      this.workMode.mode() !== WorkMode.SIMULATION &&
      // Only over the main board — the tutorial targets the main project, not a
      // custom-component edit tab that happens to be active.
      this.projectService.activeProject() === this.projectService.mainProject()
  );

  protected start(): void {
    void this.runner.launch(GETTING_STARTED_TUTORIAL);
  }

  protected dismiss(): void {
    this.onboarding.dismissNudge();
  }
}
