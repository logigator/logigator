import { effect, inject, Injectable, Injector, untracked } from '@angular/core';
import posthog from 'posthog-js';
import { WorkModeService } from '../work-mode/work-mode.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import { SimulationService } from '../simulation/simulation.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { ProjectService } from '../project/project.service';
import { Project } from '../project/project';
import { Action } from '../actions/action';
import { environment } from '../../environments/environment';
import {
  AnalyticsEvent,
  operationProperties,
  sanitizeProperties
} from './analytics.mapping';

const ANALYTICS_CATEGORY = 'analytics';

/**
 * Vendor-neutral product-analytics sink over the `posthog-js` package. Every
 * event goes through {@link capture}, which no-ops until PostHog has been
 * initialised — and it is initialised only once the user grants the
 * `analytics` consent category (see {@link wireConsent}), so instrumentation
 * may run unconditionally and simply drops on the floor before consent. No
 * PostHog network request happens before then: importing the package is inert;
 * `posthog.init` is what loads it, and that is deferred to consent.
 *
 * {@link init} wires the self-contained observable sources (tool switches,
 * simulation lifecycle, tutorial start, and per-project edit operations); the
 * remaining events are emitted by direct {@link capture} calls at their method
 * sites (persistence, promotion, compile diagnostics, docs, tutorial end,
 * share-link, errors).
 *
 * Construction is deliberately dependency-free — the event sources are resolved
 * lazily in {@link init} — so the many services that inject this sink to report
 * events can never form a DI cycle with it.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly injector = inject(Injector);

  private initialized = false;
  private subscribedProject: Project | null = null;
  private unsubscribeActions: (() => void) | null = null;

  /** Sends an event, dropped silently until PostHog is initialised on consent.
   * Never throws — some call sites (the `onBeforeRecord` edit hook) run inside a
   * critical user gesture, and a failing third-party `capture` must not break
   * the operation that emitted the event. */
  public capture(event: string, properties?: Record<string, unknown>): void {
    if (!this.initialized) return;
    try {
      posthog.capture(event, properties && sanitizeProperties(properties));
    } catch {
      // Analytics must never break the operation that emitted the event.
    }
  }

  /** Records an uncaught error as a behavioural signal (name + message only —
   * a stack can carry file paths). */
  public captureError(error: unknown): void {
    const err = error as { name?: unknown; message?: unknown } | null;
    this.capture(AnalyticsEvent.EditorError, {
      name: typeof err?.name === 'string' ? err.name : 'Error',
      message: typeof err?.message === 'string' ? err.message : String(error)
    });
  }

  /** Wires the consent gate and the observable event sources. Called once at
   * app startup (from `main.ts`, after bootstrap). */
  public init(): void {
    this.wireConsent();
    this.watchWorkMode(this.injector.get(WorkModeService));
    this.watchSimulation(this.injector.get(SimulationService));
    this.watchTutorial(this.injector.get(OnboardingService));
    this.watchActiveProject(this.injector.get(ProjectService));
  }

  /**
   * Gates PostHog on the `analytics` consent category. The consent bundle
   * (vanilla-cookieconsent, loaded by `ConsentService`) dispatches `cc:onConsent`
   * on load / first grant and `cc:onChange` on later preference changes; both
   * re-evaluate here. PostHog is initialised once on first grant and toggled
   * opt-in/opt-out afterwards. Under a bare `ng serve` the bundle never loads,
   * so `window.CookieConsent` stays undefined and analytics stays inert.
   */
  private wireConsent(): void {
    const sync = (): void => this.syncConsent();
    window.addEventListener('cc:onConsent', sync);
    window.addEventListener('cc:onChange', sync);
    this.syncConsent();
  }

  private syncConsent(): void {
    const granted = !!window.CookieConsent?.acceptedCategory(ANALYTICS_CATEGORY);
    if (granted && !this.initialized && environment.analytics.posthogKey) {
      posthog.init(environment.analytics.posthogKey, {
        api_host: environment.analytics.posthogHost,
        person_profiles: 'identified_only',
        autocapture: false
      });
      this.initialized = true;
    } else if (this.initialized) {
      if (granted) posthog.opt_in_capturing();
      else posthog.opt_out_capturing();
    }
  }

  private watchWorkMode(workMode: WorkModeService): void {
    let previous = workMode.mode();
    effect(
      () => {
        const mode = workMode.mode();
        const prev = previous;
        previous = mode;
        // SIMULATION is covered by the simulation lifecycle events.
        if (mode === prev || mode === WorkMode.SIMULATION) return;
        this.capture(AnalyticsEvent.ToolSelected, { mode });
      },
      { injector: this.injector }
    );
  }

  private watchSimulation(simulation: SimulationService): void {
    let previous = simulation.state();
    effect(
      () => {
        const state = simulation.state();
        const prev = previous;
        previous = state;
        if (state === 'ready' && prev !== 'ready' && prev !== 'running')
          this.capture(AnalyticsEvent.SimulationStarted, {
            runMode: untracked(() => simulation.mode())
          });
        else if (state === 'inactive' && prev !== 'inactive')
          this.capture(AnalyticsEvent.SimulationStopped);
      },
      { injector: this.injector }
    );
  }

  private watchTutorial(onboarding: OnboardingService): void {
    let previous = onboarding.activeTutorial();
    effect(
      () => {
        const tutorial = onboarding.activeTutorial();
        const prev = previous;
        previous = tutorial;
        // End (completed vs abandoned) is captured at endTutorial's call site,
        // the only source carrying that distinction.
        if (tutorial && tutorial !== prev)
          this.capture(AnalyticsEvent.TutorialStarted, { tutorial });
      },
      { injector: this.injector }
    );
  }

  private watchActiveProject(projects: ProjectService): void {
    // ActionManager is per-project, so re-subscribe when the active project
    // changes and tear down the previous hook to avoid leaks / double-counting.
    effect(
      () => {
        const project = projects.activeProject();
        if (project === this.subscribedProject) return;
        this.unsubscribeActions?.();
        this.unsubscribeActions = null;
        this.subscribedProject = project;
        if (!project) return;
        this.unsubscribeActions = project.actionManager.onBeforeRecord(
          (action) => this.captureOperation(action)
        );
      },
      { injector: this.injector }
    );
  }

  private captureOperation(action: Action): void {
    this.capture(
      AnalyticsEvent.EditorOperation,
      operationProperties(action.serialize())
    );
  }
}
