import { computed, inject, Injectable, signal } from '@angular/core';
import { LayoutService } from '../layout/layout.service';
import { LoggingService } from '../logging/logging.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEvent } from '../analytics/analytics.mapping';

/**
 * The two device axes onboarding content is authored for. Derived from the
 * layout breakpoint (compact chrome vs. desktop bars) rather than input type:
 * step targets and gesture wording follow which UI is on screen.
 */
export type OnboardingPlatform = 'desktop' | 'compact';

/** The flagship first-run tutorial, launched only from the first-run nudge. */
export const GETTING_STARTED_TUTORIAL = 'getting-started';

const TIPS_ENABLED_KEY = 'onboarding.tips-enabled';
const COMPLETED_TUTORIALS_KEY = 'onboarding.completed-tutorials';
const SEEN_HINTS_KEY = 'onboarding.seen-hints';
const NUDGE_DISMISSED_KEY = 'onboarding.nudge-dismissed';

/**
 * Single orchestrator and persistence gate for the whole onboarding surface —
 * the hands-on tutorials (Phase 2) and the just-in-time hints (Phase 3) both
 * read their enable/seen/completed state from here.
 *
 * Persistence mirrors {@link ChangelogService}: plain `localStorage` under the
 * `onboarding.*` namespace, degrading silently when storage is unavailable
 * (private mode) so the editor never breaks over a preference write. The
 * user-visible "show tips" toggle is this same global flag.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly layout = inject(LayoutService);
  private readonly logging = inject(LoggingService);
  private readonly analytics = inject(AnalyticsService);

  private readonly _tipsEnabled = signal(this.loadBool(TIPS_ENABLED_KEY, true));
  /** Master switch: false silences every tutorial and hint. */
  public readonly tipsEnabled = this._tipsEnabled.asReadonly();

  private readonly _nudgeDismissed = signal(
    this.loadBool(NUDGE_DISMISSED_KEY, false)
  );
  /**
   * Whether the first-run "take the tutorial" nudge has been dismissed. The
   * nudge is the only launch path (there is no auto-start): it shows once for a
   * new user and, once dismissed or once the tutorial starts, never returns.
   */
  public readonly nudgeDismissed = this._nudgeDismissed.asReadonly();

  private readonly _activeTutorial = signal<string | null>(null);
  /** Id of the tutorial currently running, or null. The runner reacts to this. */
  public readonly activeTutorial = this._activeTutorial.asReadonly();

  private readonly _completedTutorials = this.loadSet(COMPLETED_TUTORIALS_KEY);
  private readonly _seenHints = this.loadSet(SEEN_HINTS_KEY);

  /** Which authored variant of a step/hint applies on this device. */
  public readonly platform = computed<OnboardingPlatform>(() =>
    this.layout.isCompact() ? 'compact' : 'desktop'
  );

  /**
   * Flips the master switch and persists it. Turning tips off also ends any
   * running tutorial without marking it complete, so it can be resumed later.
   */
  public setTipsEnabled(enabled: boolean): void {
    this._tipsEnabled.set(enabled);
    this.saveBool(TIPS_ENABLED_KEY, enabled);
    this.logging.debug(
      `tips ${enabled ? 'enabled' : 'disabled'}`,
      'OnboardingService'
    );
    if (!enabled && this._activeTutorial() !== null) {
      this.endTutorial(false);
    }
  }

  /** The "turn off all tips" control on the coach-mark bubble and in settings. */
  public disableAllTips(): void {
    this.setTipsEnabled(false);
  }

  /**
   * Re-enables tips, forgets which hints have been seen (so the JIT hints
   * surface again on their next trigger), clears completed tutorials (so they
   * can be started again from the nudge), and restores the first-run tutorial
   * nudge.
   */
  public showTipsAgain(): void {
    this.logging.debug('show tips again (reset)', 'OnboardingService');
    this._seenHints.clear();
    this.saveSet(SEEN_HINTS_KEY, this._seenHints);
    this._completedTutorials.clear();
    this.saveSet(COMPLETED_TUTORIALS_KEY, this._completedTutorials);
    this._nudgeDismissed.set(false);
    this.saveBool(NUDGE_DISMISSED_KEY, false);
    this.setTipsEnabled(true);
  }

  public hasCompletedTutorial(id: string): boolean {
    return this._completedTutorials.has(id);
  }

  public hasSeenHint(id: string): boolean {
    return this._seenHints.has(id);
  }

  public markHintSeen(id: string): void {
    if (this._seenHints.has(id)) return;
    this._seenHints.add(id);
    this.saveSet(SEEN_HINTS_KEY, this._seenHints);
    this.logging.debug(`mark hint seen ${id}`, 'OnboardingService');
  }

  /** Starts a tutorial regardless of completed state. */
  public startTutorial(id: string): void {
    this._activeTutorial.set(id);
    this.logging.debug(`start tutorial ${id}`, 'OnboardingService');
  }

  /** Permanently hides the first-run nudge (dismissed, or the tutorial started). */
  public dismissNudge(): void {
    if (this._nudgeDismissed()) return;
    this._nudgeDismissed.set(true);
    this.saveBool(NUDGE_DISMISSED_KEY, true);
    this.logging.debug('nudge dismissed', 'OnboardingService');
  }

  /** Ends the active tutorial as skipped (not completed) — Skip button / Esc. */
  public skipCurrent(): void {
    this.endTutorial(false);
  }

  /**
   * Clears the active tutorial. When `completed`, its id is recorded so the
   * first-run nudge stops offering it.
   */
  public endTutorial(completed: boolean): void {
    const id = this._activeTutorial();
    if (id === null) return;
    if (completed && !this._completedTutorials.has(id)) {
      this._completedTutorials.add(id);
      this.saveSet(COMPLETED_TUTORIALS_KEY, this._completedTutorials);
    }
    this._activeTutorial.set(null);
    this.analytics.capture(
      completed
        ? AnalyticsEvent.TutorialCompleted
        : AnalyticsEvent.TutorialAbandoned,
      { tutorial: id }
    );
    this.logging.debug(
      `end tutorial ${id} (completed=${completed})`,
      'OnboardingService'
    );
  }

  private loadBool(key: string, fallback: boolean): boolean {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : raw === 'true';
    } catch {
      return fallback;
    }
  }

  private saveBool(key: string, value: boolean): void {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // Private-mode / disabled storage: preference degrades to session-only.
    }
  }

  private loadSet(key: string): Set<string> {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return new Set();
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed)
        ? new Set(parsed.filter((v): v is string => typeof v === 'string'))
        : new Set();
    } catch {
      return new Set();
    }
  }

  private saveSet(key: string, value: Set<string>): void {
    try {
      localStorage.setItem(key, JSON.stringify([...value]));
    } catch {
      // Private-mode / disabled storage: preference degrades to session-only.
    }
  }
}
