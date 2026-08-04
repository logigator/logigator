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
import { provideLgLabels } from '@logigator/ui';
import { ConsentService } from './consent/consent.service';
import { AnalyticsService } from './analytics/analytics.service';
import { provideDialogAnalytics } from './analytics/dialog-telemetry';
import { TranslationService } from './translation/translation.service';

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
      storageKey: 'logigator.transloco.lang',
      storage: {
        useValue: localStorage
      }
    }),
    provideAppInitializer(() => {
      // Resolved for its side effect: constructing TranslationService puts the
      // active language on <html lang> before first paint. Nothing else needs
      // the service this early.
      inject(TranslationService);
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
    provideAppInitializer(() => {
      inject(AnalyticsService).init();
    }),
    // @logigator/ui's stock strings (close/back/dismiss buttons, paginator
    // steps, reorder announcements) come from `common.*`, so every dialog,
    // drawer and window the library renders is localized without each call site
    // passing a label — including ones added later. The resolver is consulted
    // per component construction, so a short-lived surface always opens in the
    // current language; long-lived ones bind the input in their template.
    provideLgLabels(() => {
      const translation = inject(TranslationService);
      return (key) => translation.translate(`common.${key}`);
    }),
    provideDialogAnalytics(),
    provideHttpClient(),
    provideMarkdown({ loader: HttpClient })
  ]
};
