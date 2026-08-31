import { Provider, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {
  TRANSLOCO_MISSING_HANDLER,
  TranslocoMissingHandler
} from '@jsverse/transloco';
import { appConfig } from '../app/app.config';
import { setStaticDIInjector } from '../app/utils/get-di';
import { TranslocoPersistLangService } from '@jsverse/transloco-persist-lang';
import { AnalyticsService } from '../app/analytics/analytics.service';

// The app initializer calls AnalyticsService.init(), which eagerly resolves
// LayoutService/OnboardingService/etc. and wires effects — breaking specs that
// build those services lazily under per-test mocks (matchMedia, cookies). The
// capture logic is unit-tested directly in analytics.mapping.spec.ts.
class NoopAnalyticsService {
  init(): void {
    /* empty */
  }
  capture(): void {
    /* empty */
  }
  captureError(): void {
    /* empty */
  }
}

// Returns the key like the default handler, but without the console warning:
// the language bundle loads via a lazy dynamic import, so content rendered
// before it resolves would warn about keys that do exist. The app preloads the
// language before bootstrap, so the gap is test-only.
class SilentTranslocoMissingHandler implements TranslocoMissingHandler {
  handle(key: string): string {
    return key;
  }
}

const TRANSLOCO_PERSIST_STUB = {
  getCachedLang: () => null,
  clear: () => {
    /* empty */
  }
} as unknown as TranslocoPersistLangService;

/**
 * Configures TestBed with the full application provider set plus an HTTP
 * testing backend and the real Transloco wiring, then wires the static DI
 * injector model classes resolve through. Call once per `beforeEach`.
 *
 * Transloco is real rather than stubbed because a stub cannot drive the
 * `*appTranslate` directive components render, so component specs route
 * through here too, passing the components under test via `imports`.
 *
 * @param overrides test-specific providers, appended last so they shadow any
 *   default.
 * @param imports standalone components/modules to declare for the test module.
 */
export function configureTestBed(
  overrides: Provider[] = [],
  imports: unknown[] = []
): void {
  TestBed.configureTestingModule({
    imports,
    providers: [
      ...appConfig.providers,
      provideHttpClientTesting(),
      {
        provide: TRANSLOCO_MISSING_HANDLER,
        useClass: SilentTranslocoMissingHandler
      },
      {
        provide: TranslocoPersistLangService,
        useValue: TRANSLOCO_PERSIST_STUB
      },
      { provide: AnalyticsService, useClass: NoopAnalyticsService },
      ...overrides
    ]
  });
  setStaticDIInjector(TestBed.inject(Injector));
}
