import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { PostHog } from 'posthog-js';
import { environment } from '../../environments/environment';
import { TranslationService } from '../translation/translation.service';

const ANALYTICS_CATEGORY = 'analytics';

/**
 * Distinguishes this surface from the two editors sharing the PostHog project,
 * whose `$pageview` and `$autocapture` events are otherwise identical. Kept in
 * sync with the editor's `APP_ID` and the legacy editor's `before_send` hook.
 */
const APP_ID = 'website';

/**
 * Vendor-neutral product-analytics sink over `posthog-js`, mirroring the
 * editor's. PostHog is loaded and initialised only once the visitor grants the
 * `analytics` consent category, so instrumentation may run unconditionally:
 * every capture is gated on {@link initialized} and drops on the floor before
 * consent. The package sits behind a dynamic import, so a session that declines
 * never downloads it, and a server render never reaches the import at all —
 * only a consent event starts it.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly translation = inject(TranslationService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private initialized = false;
  private posthog: PostHog | null = null;
  /** In-flight (or settled) import, so concurrent consent events share one. */
  private posthogLoad: Promise<PostHog> | null = null;

  /** Sends an event, dropped silently until PostHog is initialised on consent.
   * Never throws: a failing third-party `capture` must not break the operation
   * that emitted the event. */
  public capture(event: string, properties?: Record<string, unknown>): void {
    if (!this.initialized) return;
    try {
      this.posthog?.capture(event, properties);
    } catch {
      // Analytics must never break the operation that emitted the event.
    }
  }

  /** Wires the consent gate. Called once at app startup. */
  public init(): void {
    if (!this.isBrowser) return;
    this.wireConsent();
  }

  /**
   * Gates PostHog on the `analytics` consent category: initialised once on the
   * first grant, toggled opt-in/opt-out afterwards. Under a bare `ng serve`
   * without the consent bundle, `window.CookieConsent` stays undefined and
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
      if (granted) this.posthog?.opt_in_capturing();
      else this.posthog?.opt_out_capturing();
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
      // HTTPS-only identity cookie.
      secure_cookie: true,
      // No feature flags / experiments are used, so skip the /flags request.
      advanced_disable_feature_flags: true,
      // Core Web Vitals, which is what a content site is judged on.
      capture_performance: true,
      loaded: () => this.registerSuperProperties(posthog)
    });
    this.initialized = true;
    this.syncConsent();
  }

  /**
   * Stamps {@link APP_ID} and the page's language on every event, so language
   * is a breakdown on any event. PostHog's `$browser_language` cannot stand in:
   * the language is the URL's first segment, negotiated once per document.
   *
   * Registered from `loaded` rather than after `init` returns, because the
   * session's `$pageview` is captured from a timeout PostHog schedules in that
   * same callback — and for a visitor who reads one page and leaves, it is the
   * only event there is.
   */
  private registerSuperProperties(instance: PostHog): void {
    try {
      instance.register({
        app: APP_ID,
        ui_language: this.translation.getActiveLang()
      });
    } catch {
      // Analytics must never break the surrounding operation.
    }
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
}
