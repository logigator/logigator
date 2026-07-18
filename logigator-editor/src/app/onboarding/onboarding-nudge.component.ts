import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslocoDirective } from '@jsverse/transloco';
import { LgButton } from '@logigator/ui';
import { ProjectService } from '../project/project.service';
import { WorkModeService } from '../work-mode/work-mode.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import {
  GETTING_STARTED_TUTORIAL,
  OnboardingService
} from './onboarding.service';

/**
 * Soft, always-on discovery baseline: while the board is empty (and no tutorial
 * is running), offers to launch the getting-started tutorial. Complements the
 * first-run auto-start — it catches returning users and anyone who skipped, and
 * is the entry point since the empty main project is exactly where the tutorial
 * runs. Dismissible for the session; hidden the moment anything is placed.
 */
@Component({
  selector: 'app-onboarding-nudge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, LgButton],
  template: `
    @if (visible()) {
      <div
        *transloco="let t"
        class="pointer-events-auto flex items-center gap-3 rounded-lg border border-border bg-content/95 px-4 py-3 shadow-lg backdrop-blur"
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
  private readonly projectService = inject(ProjectService);
  private readonly workMode = inject(WorkModeService);

  private readonly dismissed = signal(false);
  // No project-level "elements changed" signal exists, so bump a revision from
  // the action stream (and on project swap) to re-derive emptiness reactively.
  private readonly revision = signal(0);
  private actionSub: Subscription | null = null;

  private readonly isEmpty = computed(() => {
    this.revision();
    const project = this.projectService.mainProject();
    return !!project && [...project.components].length === 0;
  });

  protected readonly visible = computed(
    () =>
      !this.dismissed() &&
      this.onboarding.tipsEnabled() &&
      this.onboarding.activeTutorial() === null &&
      this.workMode.mode() !== WorkMode.SIMULATION &&
      this.isEmpty()
  );

  constructor() {
    effect(() => {
      const project = this.projectService.mainProject();
      this.actionSub?.unsubscribe();
      this.revision.update((value) => value + 1);
      if (project) {
        this.actionSub = project.actionManager.actionChange$.subscribe(() =>
          this.revision.update((value) => value + 1)
        );
      }
    });
  }

  protected start(): void {
    this.onboarding.startTutorial(GETTING_STARTED_TUTORIAL);
  }

  protected dismiss(): void {
    this.dismissed.set(true);
  }
}
