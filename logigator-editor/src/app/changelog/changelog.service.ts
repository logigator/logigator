import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DialogService } from '@logigator/ui';
import { TranslationService } from '../translation/translation.service';
import { ChangelogDialogComponent } from '../ui/dialogs/changelog-dialog/changelog-dialog.component';
import { environment } from '../../environments/environment';
import { CookieService } from '../storage/cookie.service';
import changelogEn from '@assets/changelog/changelog.en.md';

const LAST_SEEN_KEY = 'logigator.changelog.lastSeenVersion';

/**
 * Cookies the old editor writes that mark a browser as having used it. The
 * legacy editor persists everything through cookies (its `StorageService` is
 * bound to a cookie-backed store) on the shared origin: `tutorials` on
 * finishing/skipping the auto-started getting-started tour, `autoStartSim` on
 * toggling simulation auto-start, `sneaks` on discovering an easter egg. None is
 * written by the rebuilt editor or the marketing site, so their presence
 * identifies a returning legacy user — unlike `cc_cookie` (the cookie-consent
 * bar runs site-wide) or `preferences` (the backend sets it for language), both
 * of which any first-time visitor also has.
 */
const LEGACY_COOKIES = ['tutorials', 'autoStartSim', 'sneaks'] as const;

/**
 * Build-time hashed URLs of the changelog markdown, keyed by language (the `.md`
 * file loader emits a cache-busted copy per import). English is the fallback for
 * any language without its own entry. Add a `changelog.<lang>.md` import here to
 * ship a translated changelog; until then every language resolves to English.
 */
const CHANGELOG_URLS: Readonly<Record<string, string>> = {
  en: changelogEn
};

/**
 * Tracks which release the user has seen and opens the "what's new" dialog once
 * per new version.
 *
 * The version comparison uses the build's `environment.version`, so a new
 * release must bump the app version (package.json) to trigger the dialog. This
 * lets `maybeAutoOpen` decide entirely from `localStorage` — the markdown is
 * only fetched when the dialog actually opens, never just to check for updates.
 *
 * The changelog body ships in English only; localized dialog chrome is
 * translated separately.
 */
@Injectable({
  providedIn: 'root'
})
export class ChangelogService {
  private readonly http = inject(HttpClient);
  private readonly translation = inject(TranslationService);
  private readonly dialogService = inject(DialogService);
  private readonly cookieService = inject(CookieService);

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

  /** Opens the changelog dialog (which acknowledges the running version). */
  public open(): void {
    this.dialogService.open(ChangelogDialogComponent, {
      header: this.translation.translate('changelogDialog.header'),
      width: '40rem',
      modal: true,
      closable: true
    });
  }

  /**
   * Opens the changelog once when the running version is newer than the one the
   * user last saw — decided from `localStorage` alone, without fetching the
   * markdown.
   *
   * On the first ever load (no stored version) the running release is
   * acknowledged silently so the dialog never greets a genuinely new user — with
   * one exception: a user arriving from the old editor is shown the changelog so
   * they learn what changed in the rebuild.
   */
  public maybeAutoOpen(): void {
    const seen = this.lastSeenVersion();
    if (seen === null) {
      if (this.isReturningLegacyUser()) {
        this.open();
      }
      this.acknowledge();
      return;
    }
    if (this.isNewer(environment.version, seen)) {
      this.open();
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

  /**
   * Whether this browser has used the old editor, decided from the cookies the
   * legacy editor leaves behind (see {@link LEGACY_COOKIES}). A returning user
   * is shown the changelog on their first load of the rebuilt editor.
   */
  private isReturningLegacyUser(): boolean {
    return LEGACY_COOKIES.some(
      (name) => this.cookieService.get(name) !== null
    );
  }
}
