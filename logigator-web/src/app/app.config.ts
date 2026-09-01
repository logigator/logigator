import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection
} from '@angular/core';
import {
  provideClientHydration,
  withEventReplay,
  withNoHttpTransferCache
} from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import {
  provideHttpClient,
  withFetch,
  withInterceptors
} from '@angular/common/http';
import {
  provideRouter,
  TitleStrategy,
  withInMemoryScrolling
} from '@angular/router';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { provideLgLabels } from '@logigator/ui';
import { routes } from './app.routes';
import { AVAILABLE_LANGUAGES, DEFAULT_LANGUAGE } from '@logigator/core';
import { TranslationLoaderService } from './translation/translation-loader.service';
import { TranslationService } from './translation/translation.service';
import { resolveDocumentLanguage } from './translation/document-language';
import { SeoTitleStrategy } from './seo/seo-title.strategy';
import { ThemingService } from './theming/theming.service';
import { SessionService } from './user/session.service';
import { AnalyticsService } from './analytics/analytics.service';
import { providePageviewTracking } from './analytics/pageview-tracking';
import { apiOriginInterceptor } from './api/server-api.interceptor';
import { SITE_ORIGIN } from './seo/site-origin';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled'
      })
    ),
    { provide: TitleStrategy, useClass: SeoTitleStrategy },
    // Event replay keeps a click that lands during hydration. The HTTP transfer
    // cache is off because it cannot cover this app's reads: every server-side
    // request carries the visitor's cookie, which the cache treats as an
    // authorization header and skips, and it keys on the URL after
    // `apiOriginInterceptor` has moved it onto the API's own origin. What has
    // to cross does so explicitly, as `SessionService` and the translation
    // loader do.
    provideClientHydration(withEventReplay(), withNoHttpTransferCache()),
    // `withFetch` because the server render has no XHR; the interceptor is
    // registered on both platforms and is inert in the browser, where the API
    // is a path on the same origin.
    provideHttpClient(withFetch(), withInterceptors([apiOriginInterceptor])),
    {
      provide: SITE_ORIGIN,
      useFactory: () => inject(DOCUMENT).location.origin
    },
    provideTransloco({
      config: {
        defaultLang: DEFAULT_LANGUAGE,
        availableLangs: [...AVAILABLE_LANGUAGES],
        reRenderOnLangChange: false,
        prodMode: !isDevMode()
      },
      loader: TranslationLoaderService
    }),
    // The language is the URL's first segment, so it is settled before anything
    // renders and never changes within a document — a switch rewrites the URL.
    provideAppInitializer(() => {
      const transloco = inject(TranslocoService);
      transloco.setActiveLang(resolveDocumentLanguage());
      inject(TranslationService).syncDocumentLang();
      return firstValueFrom(transloco.load(transloco.getActiveLang()), {
        defaultValue: undefined
      });
    }),
    provideAppInitializer(() => {
      // Resolved for its side effect: constructing it puts the theme class on
      // <html>, which on the server means the first byte carries it.
      inject(ThemingService);
    }),
    provideAppInitializer(() => inject(SessionService).resolve()),
    provideAppInitializer(() => {
      // Inert until the consent bundle reports the `analytics` category, and
      // inert altogether on the server.
      inject(AnalyticsService).init();
    }),
    providePageviewTracking(),
    // @logigator/ui's stock strings come from `common.*`, so every surface the
    // library renders is localized without its call site passing a label.
    provideLgLabels(() => {
      const translation = inject(TranslationService);
      return (key) => translation.translate(`common.${key}`);
    })
  ]
};
