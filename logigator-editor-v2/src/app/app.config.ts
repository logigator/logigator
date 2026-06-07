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
        availableLangs: ['en', 'de'],
        reRenderOnLangChange: true,
        prodMode: !isDevMode()
      },
      loader: TranslationLoaderService
    }),
    provideHttpClient()
  ]
};
