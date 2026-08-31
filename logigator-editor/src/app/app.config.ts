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
import { AVAILABLE_LANGUAGES } from './translation/languages';
import {
  preferencesLangStorage,
  resolveStartupLang
} from './translation/preferences-lang.storage';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideZonelessChangeDetection(),
    provideTransloco({
      config: {
        defaultLang: 'en',
        availableLangs: [...AVAILABLE_LANGUAGES],
        reRenderOnLangChange: true,
        prodMode: !isDevMode()
      },
      loader: TranslationLoaderService
    }),
    // The language lives in the `lang` field of the origin-wide `preferences`
    // cookie, which the surrounding pages read and write too. This provider's
    // initializer runs before the ones below, so the language is active before
    // `<html lang>` is stamped and before the bundle preload picks one.
    provideTranslocoPersistLang({
      storageKey: 'lang',
      storage: {
        useFactory: preferencesLangStorage
      },
      getLangFn: resolveStartupLang
    }),
    provideAppInitializer(() => {
      // Resolved for its side effect: constructing TranslationService puts
      // the active language on <html lang> before first paint.
      inject(TranslationService);
    }),
    provideAppInitializer(() => {
      const transloco = inject(TranslocoService);
      // load() ends with takeUntilDestroyed, so a teardown before the lazy
      // bundle resolves completes the stream without emitting. defaultValue
      // resolves that instead of rejecting; a genuine error still propagates.
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
    // @logigator/ui's stock strings come from `common.*`, so every surface the
    // library renders is localized without its call site passing a label. The
    // resolver is consulted per component construction, so a short-lived
    // surface opens in the current language; long-lived ones bind the input.
    provideLgLabels(() => {
      const translation = inject(TranslationService);
      return (key) => translation.translate(`common.${key}`);
    }),
    provideDialogAnalytics(),
    provideHttpClient(),
    provideMarkdown({ loader: HttpClient })
  ]
};
