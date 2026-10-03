import { inject, Injectable, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AvailableLangs, TranslocoService } from '@jsverse/transloco';
import { TranslateArgs } from './translate-args.model';
import { TranslationKey } from './translation-key.model';
import { TranslationResult } from './translation-result.model';

/**
 * Strictly typed facade over `TranslocoService`, and the only translation
 * surface the app's TypeScript should touch; templates go through
 * `TranslateDirective` (`*appTranslate="let t"`), which delegates here.
 *
 * Beyond typing, it supplies reactivity the zoneless app needs: an imperative
 * `translate()` is not reactive, and `activeLang`/`langChanges$` emit
 * synchronously inside `setActiveLang()`, before the lazily loaded bundle
 * resolves. {@link translate} instead reads a signal that emits only *after*
 * the bundle loads, so consumers re-run once, with no stale flash.
 */
@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly transloco = inject(TranslocoService);

  /**
   * The active language's translations, emitted once the lazily loaded bundle
   * resolves. Read purely as a reactive dependency; transloco does the lookup.
   */
  private readonly loadedTranslation = toSignal(
    this.transloco.selectTranslation()
  );

  /**
   * The active language id. Fires synchronously on switch, before the bundle
   * loads, so it is safe for identity only — never to gate translated text.
   */
  public readonly activeLang: Signal<string> = this.transloco.activeLang;

  constructor() {
    // The persisted-lang plugin has already restored the language by first
    // injection, so the document declares the right one from the start.
    this.syncDocumentLang();
  }

  /**
   * Translates a key. Inside a reactive context the result stays live: a
   * language switch re-runs the consumer once the new bundle has loaded.
   * Outside one it is a plain synchronous lookup.
   */
  public translate<T extends TranslationKey>(
    key: T,
    ...params: TranslateArgs<T>
  ): TranslationResult<T> {
    // The post-load reactive dependency; see the class comment.
    this.loadedTranslation();
    return this.transloco.translate(key, params[0]);
  }

  public getActiveLang(): string {
    return this.transloco.getActiveLang();
  }

  public setActiveLang(lang: string): void {
    this.transloco.setActiveLang(lang);
    this.syncDocumentLang();
  }

  /**
   * Mirrors the active language onto `<html lang>`, which `index.html` ships as
   * a static `en`. It drives screen-reader pronunciation and hyphenation and
   * signals the language to crawlers.
   *
   * Run from the constructor rather than an app initializer, so the attribute
   * follows from this service existing. `activeLang` suffices: the attribute
   * names the language rather than carrying translated text, so it need not
   * wait for the bundle.
   */
  public syncDocumentLang(): void {
    document.documentElement.lang = this.transloco.getActiveLang();
  }

  public getAvailableLangs(): AvailableLangs {
    return this.transloco.getAvailableLangs();
  }
}
