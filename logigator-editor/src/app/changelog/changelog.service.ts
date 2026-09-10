import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DialogService } from '@logigator/ui';
import { TranslationService } from '../translation/translation.service';
import { ChangelogDialogComponent } from '../ui/dialogs/changelog-dialog/changelog-dialog.component';
import { environment } from '../../environments/environment';
import { CookieService } from '../storage/cookie.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEvent, DialogId } from '../analytics/analytics.mapping';
import changelogEn from '@logigator/docs/changelog/en.md';
import changelogDe from '@logigator/docs/changelog/de.md';
import changelogFr from '@logigator/docs/changelog/fr.md';
import changelogEs from '@logigator/docs/changelog/es.md';

const LAST_SEEN_KEY = 'logigator.changelog.lastSeenVersion';

/**
 * Cookies only the legacy editor writes on the shared origin, so their presence
 * identifies a returning legacy user. Site-wide cookies (`cc_cookie`,
 * `preferences`) cannot serve: any first-time visitor has them.
 */
const LEGACY_COOKIES = ['tutorials', 'autoStartSim', 'sneaks'] as const;

/**
 * Build-time hashed URLs of the changelog markdown, keyed by language (the `.md`
 * file loader emits a cache-busted copy per import). English is the fallback.
 */
const CHANGELOG_URLS: Readonly<Record<string, string>> = {
  en: changelogEn,
  de: changelogDe,
  fr: changelogFr,
  es: changelogEs
};

/**
 * Tracks which release the user has seen and opens the "what's new" dialog once
 * per new version.
 *
 * The comparison uses the build's `environment.version`, so a release must bump
 * the app version in package.json to trigger the dialog. That lets
 * {@link maybeAutoOpen} decide from `localStorage` alone; the markdown is
 * fetched only when the dialog opens.
 */
@Injectable({
  providedIn: 'root'
})
export class ChangelogService {
  private readonly http = inject(HttpClient);
  private readonly translation = inject(TranslationService);
  private readonly dialogService = inject(DialogService);
  private readonly cookieService = inject(CookieService);
  private readonly analytics = inject(AnalyticsService);

  /** Changelog markdown for the active language, English as fallback. */
  public load(): Observable<string> {
    const lang = this.translation.getActiveLang();
    const url = CHANGELOG_URLS[lang] ?? CHANGELOG_URLS['en'];
    return this.http.get(url, { responseType: 'text' });
  }

  /** Records the running version as seen so the dialog no longer auto-opens. */
  public acknowledge(): void {
    this.markSeen(environment.version);
  }

  /**
   * Opens the changelog dialog, which acknowledges the running version.
   * `trigger` separates the once-per-release auto-popup from a manual open.
   */
  public open(trigger: 'auto' | 'manual' = 'manual'): void {
    this.analytics.capture(AnalyticsEvent.ChangelogViewed, { trigger });
    this.dialogService.open(ChangelogDialogComponent, {
      header: this.translation.translate('changelogDialog.header'),
      width: '48rem',
      modal: true,
      closable: true,
      // Alongside `changelog_viewed`, which carries the auto-vs-manual
      // trigger the generic pair cannot.
      telemetryId: DialogId.Changelog
    });
  }

  /**
   * Opens the changelog once when the running version is newer than the one
   * last seen. On the first ever load the running release is acknowledged
   * silently, so the dialog never greets a genuinely new user — except one
   * arriving from the old editor, who is shown what changed.
   */
  public maybeAutoOpen(): void {
    const seen = this.lastSeenVersion();
    if (seen === null) {
      if (this.isReturningLegacyUser()) {
        this.open('auto');
      }
      this.acknowledge();
      return;
    }
    if (this.isNewer(environment.version, seen)) {
      this.open('auto');
      this.acknowledge();
    }
  }

  /** Whether `a` is a strictly newer semver than `b`. */
  public isNewer(a: string, b: string): boolean {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
      if (diff !== 0) {
        return diff > 0;
      }
    }
    return false;
  }

  /** Version the user last acknowledged, or null on first ever load. */
  private lastSeenVersion(): string | null {
    try {
      return localStorage.getItem(LAST_SEEN_KEY);
    } catch {
      return null;
    }
  }

  private markSeen(version: string): void {
    try {
      localStorage.setItem(LAST_SEEN_KEY, version);
    } catch {
      // Private-mode / disabled storage: degrade to re-prompting next time.
    }
  }

  /** Whether this browser has used the old editor; see {@link LEGACY_COOKIES}. */
  private isReturningLegacyUser(): boolean {
    return LEGACY_COOKIES.some((name) => this.cookieService.get(name) !== null);
  }
}
