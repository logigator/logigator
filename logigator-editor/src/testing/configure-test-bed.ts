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

// Returns the key, like the default handler, but without the console warning.
// The real TranslocoService loads its language bundle via a lazy dynamic
// import, so content rendered before that resolves would otherwise log
// "Missing translation for ..." — the keys exist; only the load is async, and
// the app preloads the language before bootstrap, so this gap is test-only.
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
 * Configures TestBed with the full application provider set (appConfig.providers)
 * plus an HTTP testing backend and the real Transloco wiring (with a silent
 * missing-key handler so the async language load doesn't warn), then wires up
 * the static DI injector used by model classes (Project, Component, Wire).
 * Call once per beforeEach.
 *
 * The real TranslocoService is used — a stub can't drive the *transloco
 * directive that components render — so component specs route through here too,
 * passing the standalone component(s) under test via `imports`.
 *
 * @param overrides test-specific providers (fake stores, mock services);
 *   appended last so they shadow any default.
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
      ...overrides
    ]
  });
  setStaticDIInjector(TestBed.inject(Injector));
}
