import { inject, Injectable, Signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { TranslateArgs } from './translate-args.model';
import { TranslationKey } from './translation-key.model';
import { TranslationResult } from './translation-result.model';
import { LanguageId } from '@logigator/core';

/**
 * Strictly typed facade over `TranslocoService`, and the only translation
 * surface the app's TypeScript should touch; templates go through
 * `TranslateDirective` (`*webTranslate="let t"`), which delegates here.
 *
 * The active language is the URL's first segment: a server render answers in
 * the language it was asked for, and {@link setActiveLang} moves the document
 * to another one, the caller navigating to the same page under the new prefix.
 */
@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);

  /**
   * The active language's translations, emitted once the table resolves. Read
   * purely as a reactive dependency; transloco does the lookup.
   */
  private readonly loadedTranslation = toSignal(
    this.transloco.selectTranslation()
  );

  /** The language the document currently renders in. */
  public readonly activeLang = this.transloco.activeLang as Signal<LanguageId>;

  /**
   * Translates a key. Inside a reactive context the result stays live until the
   * table has loaded; outside one it is a plain synchronous lookup.
   */
  public translate<T extends TranslationKey>(
    key: T,
    ...params: TranslateArgs<T>
  ): TranslationResult<T> {
    // The post-load reactive dependency; see the field comment.
    this.loadedTranslation();
    return this.transloco.translate(key, params[0]);
  }

  /**
   * Switches the document to another language: the table is loaded before it
   * becomes active, so nothing renders through the untranslated keys, and
   * `<html lang>` follows. The URL is the language's other half — a caller
   * navigates to the same page under the new prefix.
   */
  public async setActiveLang(lang: LanguageId): Promise<void> {
    await firstValueFrom(this.transloco.load(lang));
    this.transloco.setActiveLang(lang);
    this.syncDocumentLang();
  }

  public getActiveLang(): LanguageId {
    return this.transloco.getActiveLang() as LanguageId;
  }

  /**
   * Mirrors the active language onto `<html lang>`. Written through `DOCUMENT`
   * rather than the global so the server render stamps it too — it drives
   * screen-reader pronunciation and hyphenation and is what a crawler reads to
   * pair a page with its `hreflang` alternates.
   */
  public syncDocumentLang(): void {
    this.document.documentElement.lang = this.getActiveLang();
  }
}
