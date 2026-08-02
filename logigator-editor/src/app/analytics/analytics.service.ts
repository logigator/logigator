import { effect, inject, Injectable, Injector, untracked } from '@angular/core';
import type { PostHog } from 'posthog-js';
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
 * may run unconditionally and simply drops on the floor before consent.
 *
 * The `posthog-js` package itself is behind a dynamic import in
 * {@link loadPosthog}, so a session that never grants consent never downloads
 * it — 238 kB that would otherwise sit in the initial bundle. Nothing before
 * consent touches the network, and nothing before the import resolves touches
 * the module: every entry point is gated on {@link initialized}.
 *
 * {@link init} wires the self-contained observable sources (tool switches,
 * simulation lifecycle, tutorial start, and per-project edit operations); the
 * remaining events are emitted by direct {@link capture} calls at their method
 * sites (persistence, image export, promotion, compile diagnostics, docs,
 * tutorial end, share-link, custom-component create/delete, settings changes,
 * bug reports, changelog, inspection, errors).
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

  /** The lazily imported package, set once {@link loadPosthog} resolves. */
  private posthog: PostHog | null = null;
  /** In-flight (or settled) import, so concurrent consent events share one. */
  private posthogLoad: Promise<PostHog> | null = null;

  /** Sends an event, dropped silently until PostHog is initialised on consent.
   * Never throws — some call sites (the `onBeforeRecord` edit hook) run inside a
   * critical user gesture, and a failing third-party `capture` must not break
   * the operation that emitted the event. */
  public capture(event: string, properties?: Record<string, unknown>): void {
    if (!this.initialized) return;
    try {
      this.posthog?.capture(
        event,
        properties && sanitizeProperties(properties)
      );
    } catch {
      // Analytics must never break the operation that emitted the event.
    }
  }

  /** Reports an uncaught error to PostHog Error Tracking as a native
   * `$exception` event (grouped into issues, stack traces retained — client
   * stacks are just the app's own bundle URLs). Gated and guarded like
   * {@link capture}: dropped before consent-time init, and never throws, since
   * it runs inside the global error handler. */
  public captureError(error: unknown, correlationId?: string): void {
    if (!this.initialized) return;
    try {
      this.posthog?.captureException(
        error,
        correlationId ? { correlation_id: correlationId } : undefined
      );
    } catch {
      // Analytics must never re-enter the error handler.
    }
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
    const granted =
      !!window.CookieConsent?.acceptedCategory(ANALYTICS_CATEGORY);
    if (granted && !this.initialized && environment.analytics.posthogKey) {
      void this.initPosthog();
    } else if (this.initialized) {
      if (granted) this.posthog?.opt_in_capturing();
      else this.posthog?.opt_out_capturing();
    }
  }

  /**
   * Downloads and initialises PostHog. Runs only on the first grant, so a
   * session that declines analytics never fetches the package. Re-runs
   * {@link syncConsent} afterwards because consent can be withdrawn while the
   * import is in flight — by then {@link initialized} is set, so that pass
   * takes the opt-in/opt-out branch instead of initialising twice.
   */
  private async initPosthog(): Promise<void> {
    let posthog: PostHog;
    try {
      posthog = await this.loadPosthog();
    } catch {
      // Offline, or the chunk failed to load. Analytics stays inert; a later
      // consent event retries.
      return;
    }
    if (this.initialized) return;
    posthog.init(environment.analytics.posthogKey, {
      api_host: environment.analytics.posthogHost,
      ui_host: environment.analytics.posthogUiHost,
      person_profiles: 'identified_only',
      autocapture: false,
      // HTTPS-only identity cookie.
      secure_cookie: true,
      // No feature flags / experiments are used, so skip the /flags request.
      advanced_disable_feature_flags: true,
      // Core Web Vitals for the (heavy) editor load
      capture_performance: true
    });
    this.initialized = true;
    this.syncConsent();
  }

  /** Imports `posthog-js` once, sharing the promise across concurrent calls. */
  private loadPosthog(): Promise<PostHog> {
    this.posthogLoad ??= import('posthog-js').then((module) => {
      this.posthog = module.default;
      return module.default;
    });
    return this.posthogLoad.catch((err: unknown) => {
      // Let a later consent event start a fresh attempt.
      this.posthogLoad = null;
      throw err;
    });
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
