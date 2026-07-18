import { computed, inject, Injectable, signal } from '@angular/core';
import { ChangelogService } from '../changelog/changelog.service';
import { LayoutService } from '../layout/layout.service';
import { LoggingService } from '../logging/logging.service';

/**
 * The two device axes onboarding content is authored for. Derived from the
 * layout breakpoint (compact chrome vs. desktop bars) rather than input type:
 * step targets and gesture wording follow which UI is on screen.
 */
export type OnboardingPlatform = 'desktop' | 'compact';

/** The flagship first-run tutorial, auto-started once for genuinely new users. */
export const GETTING_STARTED_TUTORIAL = 'getting-started';

const TIPS_ENABLED_KEY = 'onboarding.tips-enabled';
const COMPLETED_TUTORIALS_KEY = 'onboarding.completed-tutorials';
const SEEN_HINTS_KEY = 'onboarding.seen-hints';

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
  private readonly changelog = inject(ChangelogService);
  private readonly logging = inject(LoggingService);

  private readonly _tipsEnabled = signal(this.loadBool(TIPS_ENABLED_KEY, true));
  /** Master switch: false silences every tutorial and hint. */
  public readonly tipsEnabled = computed(this._tipsEnabled);

  private readonly _activeTutorial = signal<string | null>(null);
  /** Id of the tutorial currently running, or null. The runner reacts to this. */
  public readonly activeTutorial = computed(this._activeTutorial);

  private readonly _currentStepIndex = signal(0);
  public readonly currentStepIndex = computed(this._currentStepIndex);

  private readonly _completedTutorials = this.loadSet(COMPLETED_TUTORIALS_KEY);
  private readonly _seenHints = this.loadSet(SEEN_HINTS_KEY);

  /** Which authored variant of a step/hint applies on this device. */
  public readonly platform = computed<OnboardingPlatform>(() =>
    this.layout.isCompact() ? 'compact' : 'desktop'
  );

  public isTipsEnabled(): boolean {
    return this._tipsEnabled();
  }

  /**
   * Flips the master switch and persists it. Turning tips off also ends any
   * running tutorial without marking it complete, so it can be resumed later.
   */
  public setTipsEnabled(enabled: boolean): void {
    this._tipsEnabled.set(enabled);
    this.saveBool(TIPS_ENABLED_KEY, enabled);
    if (!enabled && this._activeTutorial() !== null) {
      this.endTutorial(false);
    }
  }

  /** The "turn off all tips" control on the coach-mark bubble and in settings. */
  public disableAllTips(): void {
    this.setTipsEnabled(false);
  }

  /**
   * Re-enables tips and forgets which hints have been seen, so the JIT hints
   * surface again on their next trigger. Completed tutorials are left intact —
   * those are re-run explicitly from the Help menu.
   */
  public showTipsAgain(): void {
    this._seenHints.clear();
    this.saveSet(SEEN_HINTS_KEY, this._seenHints);
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
  }

  /** Starts a tutorial regardless of completed state (manual Help-menu re-run). */
  public startTutorial(id: string): void {
    this._activeTutorial.set(id);
    this._currentStepIndex.set(0);
    this.logging.debug(`start tutorial ${id}`, 'OnboardingService');
  }

  public setCurrentStepIndex(index: number): void {
    this._currentStepIndex.set(index);
  }

  /** Ends the active tutorial as skipped (not completed) — Skip button / Esc. */
  public skipCurrent(): void {
    this.endTutorial(false);
  }

  /**
   * Clears the active tutorial. When `completed`, its id is recorded so it never
   * auto-starts again.
   */
  public endTutorial(completed: boolean): void {
    const id = this._activeTutorial();
    if (id === null) return;
    if (completed && !this._completedTutorials.has(id)) {
      this._completedTutorials.add(id);
      this.saveSet(COMPLETED_TUTORIALS_KEY, this._completedTutorials);
    }
    this._activeTutorial.set(null);
    this._currentStepIndex.set(0);
    this.logging.debug(
      `end tutorial ${id} (completed=${completed})`,
      'OnboardingService'
    );
  }

  /**
   * Starts the getting-started tutorial only for a genuinely new user: tips on,
   * not already completed, not a returning legacy user, an empty board to build
   * in, and the changelog dialog not opened this load (so the two never greet at
   * once). Any failed gate is a silent no-op.
   */
  public maybeAutoStart(opts: {
    changelogOpened: boolean;
    projectEmpty: boolean;
  }): void {
    if (!this._tipsEnabled()) return;
    if (opts.changelogOpened) return;
    if (!opts.projectEmpty) return;
    if (this.hasCompletedTutorial(GETTING_STARTED_TUTORIAL)) return;
    if (this.changelog.isReturningLegacyUser()) return;
    this.startTutorial(GETTING_STARTED_TUTORIAL);
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
