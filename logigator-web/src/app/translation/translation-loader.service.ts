import { inject, Injectable, PLATFORM_ID, TransferState } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { translationStateKey } from './translation-transfer';

/**
 * Loads a locale table, once per document: the server render puts the table it
 * loaded into the transfer state, so the browser reads it out of the HTML
 * instead of fetching the language chunk again. Without that the first paint
 * would be server-translated and the hydrated one would flicker back through
 * the untranslated keys while the chunk downloads.
 */
@Injectable({ providedIn: 'root' })
export class TranslationLoaderService implements TranslocoLoader {
  private readonly transferState = inject(TransferState);
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));

  public async getTranslation(lang: string): Promise<Translation> {
    const key = translationStateKey(lang);
    const transferred = this.transferState.get(key, null);
    if (transferred) {
      return transferred;
    }

    // A static prefix makes this a build-time glob: esbuild emits one chunk per
    // locale file and picks between them at runtime, so an unknown `lang`
    // rejects rather than reaching the network.
    const module = await import(`../../i18n/${lang}.ts`);
    const messages = module.default as Translation;
    if (this.isServer) {
      this.transferState.set(key, messages);
    }
    return messages;
  }
}
