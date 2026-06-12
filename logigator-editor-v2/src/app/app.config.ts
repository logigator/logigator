import {
  ApplicationConfig,
  isDevMode,
  provideZonelessChangeDetection
} from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { TranslationLoaderService } from './translation/translation-loader.service';
import { providePrimeNG } from 'primeng/config';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { AppTheme } from './app.theme';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslocoPersistLang } from '@jsverse/transloco-persist-lang';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    providePrimeNG({
      theme: {
        preset: AppTheme,
        options: {
          darkModeSelector: '.dark-mode'
        }
      }
    }),
    ConfirmationService,
    MessageService,
    DialogService,
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
