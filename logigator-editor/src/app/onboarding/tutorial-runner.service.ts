import { effect, inject, Injectable, untracked } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { WorkModeService } from '../work-mode/work-mode.service';
import { ProjectService } from '../project/project.service';
import { Project } from '../project/project';
import { SimulationService } from '../simulation/simulation.service';
import { TranslationService } from '../translation/translation.service';
import { LoggingService } from '../logging/logging.service';
import { ToastService } from '../logging/toast.service';
import { TranslationKey } from '../translation/translation-key.model';
import { CoachMarkHandlers, CoachMarkView } from './coach-mark.model';
import { OnboardingPlatform, OnboardingService } from './onboarding.service';
import { OnboardingOverlayService } from './onboarding-overlay.service';
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
 * the coach-mark via {@link OnboardingOverlayService}. Purely the runtime
 * driver — persistence and the enable gate stay in {@link OnboardingService}.
 *
 * Instantiated by the app shell (which hosts the coach-mark); the effect below
 * is the whole entry point.
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
  private readonly toast = inject(ToastService);

  private readonly mode$ = toObservable(this.workMode.mode);

  /** Platform-filtered steps of the active run. */
  private steps: readonly TutorialStep[] = [];
  private index = 0;
  private baseline: ReadonlyMap<number, number> = new Map();
  private userInteracted = false;
  /** One subscription per step; torn down on every advance. */
  private stepSub = new Subscription();

  constructor() {
    // Start/stop with the active tutorial. Untracked so re-resolving the
    // platform, project, etc. inside the body doesn't re-trigger the effect.
    effect(() => {
      const active = this.onboarding.activeTutorial();
      untracked(() => this.onActiveChange(active));
    });

    // Re-render the current step when the breakpoint flips mid-run so its target
    // and gesture wording follow the platform. Accepted edge: this re-enters
    // renderCurrent, which re-captures the step baseline — resizing across the
    // breakpoint mid-step resets a sub-count (e.g. "1 of 2" → "0 of 2"). Rare
    // and self-correcting on the next placement.
    effect(() => {
      this.onboarding.platform();
      untracked(() => {
        if (this.steps.length > 0) this.renderCurrent();
      });
    });
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
    this.renderCurrent();
  }

  private teardown(): void {
    this.stepSub.unsubscribe();
    this.stepSub = new Subscription();
    this.steps = [];
    this.index = 0;
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
      this.toast.success(
        this.translation.translate(
          'onboarding.tutorials.gettingStarted.complete'
        ),
        'TutorialRunnerService'
      );
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

    // Track lever/button drives for the whole step, whatever its advanceOn is.
    this.stepSub.add(
      project.userInput$.subscribe(() => {
        this.userInteracted = true;
        this.tryAdvance(step);
      })
    );
    this.subscribeAdvance(step);
    this.showStep(step);
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
    const selector = step.target?.[platform];
    if (!selector) return null;
    return document.querySelector<HTMLElement>(selector);
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
