import {
  ApplicationConfig,
  isDevMode,
  provideZonelessChangeDetection
} from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { TranslationLoaderService } from './translation/translation-loader.service';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslocoPersistLang } from '@jsverse/transloco-persist-lang';

export const appConfig: ApplicationConfig = {
  providers: [
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
    provideHttpClient()
  ]
};
