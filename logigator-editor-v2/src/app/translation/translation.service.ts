import { inject, Injectable, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AvailableLangs, TranslocoService } from '@jsverse/transloco';
import { TranslationKey } from './translation-key.model';
import { TranslationResult } from './translation-result.model';

/**
 * Strictly typed facade over `TranslocoService`. It is the only translation
 * surface the app's TypeScript should touch (`*transloco` stays the mechanism
 * for templates); the strict key/result typing lives here rather than in a
 * module augmentation.
 *
 * The reason it exists beyond typing: the app runs zoneless, where a value
 * built with an imperative `translate()` call is not reactive on its own, and
 * `activeLang`/`langChanges$` are no help because they emit *synchronously in
 * `setActiveLang()`*, before the lazily-loaded language bundle has resolved
 * (transloco reports the load completion on `events$`, not by re-firing the
 * language signal). {@link translate} closes both gaps: it reads a signal that
 * emits only *after* the bundle loads, so any reactive consumer that calls it
 * re-runs with the new language — and exactly once, with no stale flash.
 */
@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly transloco = inject(TranslocoService);

  /**
   * The active language's translations, emitted only once its (lazily loaded)
   * bundle has resolved. Read by {@link translate} purely as a reactive
   * dependency — the value itself is unused, transloco does the lookup.
   */
  private readonly loadedTranslation = toSignal(
    this.transloco.selectTranslation()
  );

  /**
   * The active language id. Fires synchronously on switch (before the bundle
   * loads), so it is only safe for identity — never to gate translated text.
   */
  public readonly activeLang: Signal<string> = this.transloco.activeLang;

  /**
   * Translates a key. Inside a reactive context (`computed`, `effect`, or a
   * template expression — directly or through a called method) the result stays
   * live: switching language re-runs the consumer with the new translation once
   * its bundle has loaded. Outside a reactive context it is a plain synchronous
   * lookup and the signal read is a no-op.
   */
  public translate<T extends TranslationKey>(
    key: T,
    params?: Record<string, unknown>
  ): TranslationResult<T> {
    // Establish the post-load reactive dependency; see the class comment.
    this.loadedTranslation();
    return this.transloco.translate(key, params);
  }

  public getActiveLang(): string {
    return this.transloco.getActiveLang();
  }

  public setActiveLang(lang: string): void {
    this.transloco.setActiveLang(lang);
  }

  public getAvailableLangs(): AvailableLangs {
    return this.transloco.getAvailableLangs();
  }
}
