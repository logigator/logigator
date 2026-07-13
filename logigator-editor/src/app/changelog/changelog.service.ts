import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DialogService } from '@logigator/ui';
import { TranslationService } from '../translation/translation.service';
import { ChangelogDialogComponent } from '../ui/dialogs/changelog-dialog/changelog-dialog.component';
import { environment } from '../../environments/environment';
import changelogEn from '@assets/changelog/changelog.en.md';

const LAST_SEEN_KEY = 'logigator.changelog.lastSeenVersion';

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
   * Whether this browser has used the old editor. The legacy editor auto-starts
   * a getting-started tutorial and writes finished/skipped tutorials to the
   * `tutorials` localStorage key (shared across the origin), so its presence is
   * a reliable proxy for a returning user seeing the rebuilt editor first time.
   */
  private isReturningLegacyUser(): boolean {
    try {
      return localStorage.getItem('tutorials') !== null;
    } catch {
      return false;
    }
  }
}
