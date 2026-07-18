import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { ConfirmationService } from '@logigator/ui';
import { WorkModeService } from '../work-mode/work-mode.service';
import { ProjectService } from '../project/project.service';
import { Project } from '../project/project';
import { PersistenceService } from '../persistence/persistence.service';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { SimulationService } from '../simulation/simulation.service';
import { TranslationService } from '../translation/translation.service';
import { LoggingService } from '../logging/logging.service';
import { TranslationKey } from '../translation/translation-key.model';
import { CoachMarkHandlers, CoachMarkView } from './coach-mark.model';
import { OnboardingPlatform, OnboardingService } from './onboarding.service';
import { OnboardingOverlayService } from './onboarding-overlay.service';
import { OnboardingTargetRegistry } from './onboarding-target-registry.service';
import {
  StepText,
  TutorialContext,
  TutorialDefinition,
  TutorialStep
} from './tutorial.model';
import { TUTORIALS } from './tutorials/registry';

/**
 * Drives a running tutorial: reacts to {@link OnboardingService.activeTutorial},
 * filters the script to the current platform, and for each step subscribes to
 * the matching editor stream, evaluates the completion predicate, and renders
 * the coach-mark via {@link OnboardingOverlayService}. The onboarding-state
 * enable/seen/completed gate stays in {@link OnboardingService}.
 *
 * {@link launch} is the entry point that starts a tutorial: it swaps in a fresh
 * empty board first (a tutorial builds a real sample circuit and must not
 * pollute the user's work) before setting the active tutorial the effect reacts
 * to. Instantiated by the app shell (which hosts the coach-mark).
 */
@Injectable({ providedIn: 'root' })
export class TutorialRunnerService {
  private readonly onboarding = inject(OnboardingService);
  private readonly overlay = inject(OnboardingOverlayService);
  private readonly projectService = inject(ProjectService);
  private readonly workMode = inject(WorkModeService);
  private readonly sim = inject(SimulationService);
  private readonly translation = inject(TranslationService);
  private readonly logging = inject(LoggingService);
  private readonly persistence = inject(PersistenceService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly registry = inject(OnboardingTargetRegistry);

  private readonly mode$ = toObservable(this.workMode.mode);

  /** Platform-filtered steps of the active run. */
  private steps: readonly TutorialStep[] = [];
  private index = 0;
  private baseline: ReadonlyMap<number, number> = new Map();
  private userInteracted = false;
  /** The step currently on screen, or null. Drives the reactive show effect. */
  private readonly currentStep = signal<TutorialStep | null>(null);
  /** One subscription per step; torn down on every advance. */
  private stepSub = new Subscription();

  constructor() {
    // Start/stop with the active tutorial. Untracked so re-resolving the
    // platform, project, etc. inside the body doesn't re-trigger the effect.
    effect(() => {
      const active = this.onboarding.activeTutorial();
      untracked(() => this.onActiveChange(active));
    });

    // Keep the coach-mark anchored to the current step's target as it registers,
    // moves, or is re-created, and re-render its text/target when the breakpoint
    // flips the platform — all reactively, so there is no querySelector timing
    // race. The advance subscriptions and baseline stay put across a platform
    // flip (no sub-count reset), since only the presentation changes here.
    effect(() => {
      const step = this.currentStep();
      const platform = this.onboarding.platform();
      if (!step) return;
      this.registry.get(step.target?.[platform]); // track the target element
      untracked(() => this.showStep(step));
    });
  }

  /**
   * Retires the first-run nudge and starts `tutorialId` on a fresh, empty
   * board. If the current board has unsaved changes, asks to discard them
   * first (the File → New Project confirm); on cancel nothing happens and the
   * nudge stays put.
   */
  public launch(tutorialId: string): void {
    const project = this.projectService.mainProject();
    if (project && this.metadataStore.isDirty(project)) {
      this.confirmationService.confirm({
        header: this.translation.translate('titleBar.discardChanges.header'),
        message: this.translation.translate('titleBar.discardChanges.message'),
        acceptButtonProps: { severity: 'danger' },
        acceptLabel: this.translation.translate(
          'titleBar.discardChanges.accept'
        ),
        rejectButtonProps: { severity: 'secondary', outlined: true },
        rejectLabel: this.translation.translate(
          'titleBar.discardChanges.reject'
        ),
        accept: () => this.launchFresh(tutorialId)
      });
      return;
    }
    this.launchFresh(tutorialId);
  }

  private launchFresh(tutorialId: string): void {
    this.persistence.createAndSetEmptyProject();
    this.onboarding.dismissNudge();
    this.onboarding.startTutorial(tutorialId);
  }

  private onActiveChange(id: string | null): void {
    if (id === null) {
      this.teardown();
      return;
    }
    const def = TUTORIALS[id];
    if (!def) {
      this.logging.warn(`unknown tutorial "${id}"`, 'TutorialRunnerService');
      this.onboarding.endTutorial(false);
      return;
    }
    this.begin(def);
  }

  private begin(def: TutorialDefinition): void {
    const platform = this.onboarding.platform();
    this.steps = def.steps.filter((step) => this.applies(step, platform));
    this.index = 0;
    this.logging.debug(
      `begin ${def.id} (${this.steps.length} steps, ${platform})`,
      'TutorialRunnerService'
    );
    this.renderCurrent();
  }

  private teardown(): void {
    this.stepSub.unsubscribe();
    this.stepSub = new Subscription();
    this.steps = [];
    this.index = 0;
    this.currentStep.set(null);
    this.overlay.hide();
  }

  private applies(step: TutorialStep, platform: OnboardingPlatform): boolean {
    return !step.platforms || step.platforms.includes(platform);
  }

  /** Enters the step at the current index (or completes past the last one). */
  private renderCurrent(): void {
    this.stepSub.unsubscribe();
    this.stepSub = new Subscription();

    if (this.index >= this.steps.length) {
      // The final step's own coach-mark is the completion acknowledgment, so
      // there is nothing more to show here — just record the completion.
      this.logging.debug('all steps complete', 'TutorialRunnerService');
      this.onboarding.endTutorial(true);
      return;
    }

    const project = this.projectService.mainProject();
    if (!project) {
      this.onboarding.endTutorial(false);
      return;
    }

    const step = this.steps[this.index];
    this.baseline = this.countByType(project);
    this.userInteracted = false;
    this.onboarding.setCurrentStepIndex(this.index);
    this.logging.debug(
      `enter step ${step.id} (${this.index + 1}/${this.steps.length})`,
      'TutorialRunnerService'
    );

    // Record lever/button drives for the whole step so predicates can read
    // `userInteracted` (e.g. the flip-a-switch step). Only a `userInput` step
    // treats a drive as its advance trigger — other kinds advance off their own
    // stream (mode/action/frame), so a drive here must not skip them.
    this.stepSub.add(
      project.userInput$.subscribe(() => {
        this.userInteracted = true;
        if (step.advanceOn.kind === 'userInput') this.tryAdvance(step);
      })
    );
    this.subscribeAdvance(step);
    // Publish the step; the show effect renders and keeps it anchored.
    this.currentStep.set(step);
  }

  private subscribeAdvance(step: TutorialStep): void {
    switch (step.advanceOn.kind) {
      case 'manual':
        break;
      case 'workMode': {
        const target = step.advanceOn.mode;
        this.stepSub.add(
          this.mode$.subscribe((mode) => {
            if (mode === target) this.advance();
          })
        );
        break;
      }
      case 'action': {
        const project = this.projectService.mainProject();
        if (project) {
          this.stepSub.add(
            project.actionManager.actionChange$.subscribe(() =>
              this.tryAdvance(step)
            )
          );
        }
        break;
      }
      case 'simFrame':
        this.stepSub.add(
          this.sim.frame$.subscribe(() => this.tryAdvance(step))
        );
        break;
      case 'userInput':
        // Handled by the shared userInput$ subscription in renderCurrent.
        break;
    }
  }

  /** Test the step's predicate; advance, or refresh an action step's bubble. */
  private tryAdvance(step: TutorialStep): void {
    const ctx = this.context();
    if (!ctx) return;
    const advanceOn = step.advanceOn;
    const predicate =
      advanceOn.kind === 'action' ||
      advanceOn.kind === 'simFrame' ||
      advanceOn.kind === 'userInput'
        ? advanceOn.predicate
        : undefined;

    if (predicate) {
      if (predicate(ctx)) {
        this.advance();
      } else if (advanceOn.kind === 'action') {
        // Still building: refresh so live sub-counts and any nudge show. Only
        // action steps re-render — a per-frame simFrame refresh would churn.
        this.showStep(step);
      }
      return;
    }

    // simFrame/userInput with no predicate: any occurrence completes.
    this.advance();
  }

  private advance(): void {
    const step = this.steps[this.index];
    if (step) {
      this.logging.debug(`step ${step.id} completed`, 'TutorialRunnerService');
    }
    this.index++;
    this.renderCurrent();
  }

  private showStep(step: TutorialStep): void {
    const platform = this.onboarding.platform();
    const target = this.resolveTarget(step, platform);
    this.overlay.show(
      target,
      this.buildView(step, platform, target),
      this.handlers()
    );
  }

  private buildView(
    step: TutorialStep,
    platform: OnboardingPlatform,
    target: HTMLElement | null
  ): CoachMarkView {
    const ctx = this.context();
    const params = ctx && step.params ? step.params(ctx) : undefined;
    const nudgeKey = ctx && step.nudge ? step.nudge(ctx) : null;
    const bodyKey = nudgeKey ?? this.resolveText(step.text, platform);
    return {
      title: this.translation.translate(step.title),
      text: this.translation.translate(bodyKey, params),
      stepNumber: this.index + 1,
      totalSteps: this.steps.length,
      showNext: step.advanceOn.kind === 'manual',
      isFinal: this.index === this.steps.length - 1,
      placement: step.placement ?? (target ? 'bottom' : 'center')
    };
  }

  private handlers(): CoachMarkHandlers {
    return {
      next: () => this.advance(),
      skip: () => this.onboarding.skipCurrent()
    };
  }

  private resolveTarget(
    step: TutorialStep,
    platform: OnboardingPlatform
  ): HTMLElement | null {
    return this.registry.get(step.target?.[platform]);
  }

  private resolveText(
    text: StepText,
    platform: OnboardingPlatform
  ): TranslationKey {
    if (typeof text === 'string') return text;
    return (text[platform] ?? text.desktop ?? text.compact) as TranslationKey;
  }

  private context(): TutorialContext | null {
    const project = this.projectService.mainProject();
    if (!project) return null;
    return {
      project,
      sim: this.sim,
      baseline: this.baseline,
      userInteracted: this.userInteracted
    };
  }

  private countByType(project: Project): ReadonlyMap<number, number> {
    const counts = new Map<number, number>();
    for (const component of project.components) {
      const type = component.config.type;
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return counts;
  }
}
