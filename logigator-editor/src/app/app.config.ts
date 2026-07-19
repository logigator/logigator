import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  isDevMode,
  provideAppInitializer,
  provideZonelessChangeDetection
} from '@angular/core';
import { GlobalErrorHandler } from './logging/global-error-handler';
import { firstValueFrom } from 'rxjs';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { TranslationLoaderService } from './translation/translation-loader.service';
import { provideHttpClient, HttpClient } from '@angular/common/http';
import { provideTranslocoPersistLang } from '@jsverse/transloco-persist-lang';
import { provideMarkdown } from 'ngx-markdown';
import { ConsentService } from './consent/consent.service';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideZonelessChangeDetection(),
    provideTransloco({
      config: {
        defaultLang: 'en',
        availableLangs: [
          {
            id: 'en',
            label: 'English'
          },
          {
            id: 'de',
            label: 'Deutsch'
          },
          {
            id: 'fr',
            label: 'Français'
          },
          {
            id: 'es',
            label: 'Español'
          }
        ],
        reRenderOnLangChange: true,
        prodMode: !isDevMode()
      },
      loader: TranslationLoaderService
    }),
    provideTranslocoPersistLang({
      storage: {
        useValue: localStorage
      }
    }),
    provideAppInitializer(() => {
      const transloco = inject(TranslocoService);
      // load() ends with takeUntilDestroyed: if the injector is torn down
      // before the lazy language bundle resolves, the stream completes without
      // emitting. defaultValue resolves that empty completion instead of
      // rejecting; a genuine load error still propagates.
      return firstValueFrom(transloco.load(transloco.getActiveLang()), {
        defaultValue: undefined
      });
    }),
    provideAppInitializer(() => {
      inject(ConsentService).load();
    }),
    provideHttpClient(),
    provideMarkdown({ loader: HttpClient })
  ]
};
