import { effect, inject, Injectable, Injector, untracked } from '@angular/core';
import type { PostHog } from 'posthog-js';
import { WorkModeService } from '../work-mode/work-mode.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import {
  SimulationService,
  SimulationState
} from '../simulation/simulation.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { ProjectService } from '../project/project.service';
import { TranslationService } from '../translation/translation.service';
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
 * Distinguishes this app from the other surfaces sharing the PostHog project,
 * whose `$pageview`/`$autocapture` events are otherwise identical. Kept in sync
 * with the `before_send` hooks in the backend's `default.hbs` and the legacy
 * editor's `index.html`.
 */
const APP_ID = 'editor-v2';

/**
 * Vendor-neutral product-analytics sink over `posthog-js`. PostHog is loaded
 * and initialised only once the user grants the `analytics` consent category,
 * so instrumentation may run unconditionally: every entry point is gated on
 * {@link initialized} and drops on the floor before consent. The package sits
 * behind a dynamic import, so a session that declines never downloads it.
 *
 * Construction is dependency-free and the event sources are resolved lazily in
 * {@link init}, so the many services injecting this sink cannot form a DI cycle
 * with it.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly injector = inject(Injector);

  private initialized = false;
  private subscribedProject: Project | null = null;
  private unsubscribeActions: (() => void) | null = null;

  private posthog: PostHog | null = null;
  /** In-flight (or settled) import, so concurrent consent events share one. */
  private posthogLoad: Promise<PostHog> | null = null;
  /** Mirrored so {@link registerSuperProperties} can restamp it whenever
   * PostHog becomes available. */
  private uiLanguage: string | null = null;

  /** Sends an event, dropped silently until PostHog is initialised on consent.
   * Never throws: some sources run inside a critical user gesture, and a
   * failing third-party `capture` must not break the operation. */
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

  /** Reports an uncaught error as a native `$exception` event. Gated and
   * guarded like {@link capture}, and never throws — it runs inside the global
   * error handler.
   *
   * `properties` carries the machine-readable cause for a fault whose `Error`
   * message is a translated, user-facing string. Riding the event rather than
   * the message leaves issue grouping (exception type plus stack) intact. */
  public captureError(
    error: unknown,
    correlationId?: string,
    properties?: Record<string, unknown>
  ): void {
    if (!this.initialized) return;
    try {
      const eventProperties = {
        ...(properties ? sanitizeProperties(properties) : {}),
        ...(correlationId ? { correlation_id: correlationId } : {})
      };
      this.posthog?.captureException(
        error,
        Object.keys(eventProperties).length > 0 ? eventProperties : undefined
      );
    } catch {
      // Analytics must never re-enter the error handler.
    }
  }

  /** Wires the consent gate and the observable event sources. Called once at
   * app startup. */
  public init(): void {
    this.watchLanguage(this.injector.get(TranslationService));
    this.wireConsent();
    this.watchWorkMode(this.injector.get(WorkModeService));
    this.watchSimulation(this.injector.get(SimulationService));
    this.watchTutorial(this.injector.get(OnboardingService));
    this.watchActiveProject(this.injector.get(ProjectService));
  }

  /**
   * Gates PostHog on the `analytics` consent category: initialised once on the
   * first grant, toggled opt-in/opt-out afterwards. Under a bare `ng serve` the
   * consent bundle never loads, so `window.CookieConsent` stays undefined and
   * analytics stays inert.
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
      if (granted) {
        // Before opt-in, which synchronously emits `$opt_in` and the
        // session's `$pageview` — the only event a bounced session produces.
        this.registerSuperProperties();
        this.posthog?.opt_in_capturing();
      } else this.posthog?.opt_out_capturing();
    }
  }

  /**
   * Downloads and initialises PostHog on the first grant. Re-runs
   * {@link syncConsent} afterwards because consent can be withdrawn while the
   * import is in flight; {@link initialized} is set by then, so that pass takes
   * the opt-in/opt-out branch instead of initialising twice.
   */
  private async initPosthog(): Promise<void> {
    let posthog: PostHog;
    try {
      posthog = await this.loadPosthog();
    } catch {
      // Offline, or the chunk failed. A later consent event retries.
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
      capture_performance: true,
      session_recording: {
        captureCanvas: { canvasQuality: '0.3' },
        canvasCapture: { resolutionScale: 0.75 }
      }
    });
    this.initialized = true;
    this.syncConsent();
  }

  /**
   * Stamps {@link APP_ID} and the active UI language on every event, so
   * language is a breakdown on any event rather than a funnel over the one-off
   * `setting_changed`. PostHog's `$browser_language` cannot stand in: the app
   * resolves its language from the persisted setting, falling back to `en`,
   * never from the browser.
   *
   * Re-run on each language change and each consent grant, since the package
   * import can land long after startup.
   */
  private registerSuperProperties(): void {
    if (!this.initialized) return;
    try {
      this.posthog?.register({
        app: APP_ID,
        ...(this.uiLanguage ? { ui_language: this.uiLanguage } : {})
      });
    } catch {
      // Analytics must never break the surrounding operation.
    }
  }

  private watchLanguage(translation: TranslationService): void {
    // Seeded synchronously: the effect's first run is only scheduled, and
    // PostHog may already be initialising by then.
    this.uiLanguage = translation.getActiveLang();
    effect(
      () => {
        // `activeLang` fires before the bundle resolves, which is what this
        // wants: the id, not the translations.
        this.uiLanguage = translation.activeLang();
        this.registerSuperProperties();
      },
      { injector: this.injector }
    );
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
        // Keyed on the session becoming active rather than on `ready`: with
        // auto-start, `ready` and `running` are set in one synchronous block
        // and only the latter is observed. Also keeps pause/play from
        // re-reporting a start.
        if (isActive(state) && !isActive(prev))
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
        // End (completed vs abandoned) is captured where endTutorial runs,
        // the only place carrying that distinction.
        if (tutorial && tutorial !== prev)
          this.capture(AnalyticsEvent.TutorialStarted, { tutorial });
      },
      { injector: this.injector }
    );
  }

  private watchActiveProject(projects: ProjectService): void {
    // ActionManager is per-project, so re-subscribe on a project change and
    // tear down the previous hook to avoid leaks and double-counting.
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

/** Whether a simulation session is up — `starting` is not yet a session. */
function isActive(state: SimulationState): boolean {
  return state === 'ready' || state === 'running';
}
