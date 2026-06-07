import { Provider, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslocoService } from '@jsverse/transloco';
import { appConfig } from '../app/app.config';
import { setStaticDIInjector } from '../app/utils/get-di';

// Stub that returns the key so tests don't log "Missing translation".
const TRANSLOCO_STUB = {
  translate: (key: string) => key
} as unknown as TranslocoService;

/**
 * Configures TestBed with the full application provider set (appConfig.providers)
 * plus an HTTP testing backend and a silent TranslocoService stub, then wires up
 * the static DI injector used by model classes (Project, Component, Wire).
 * Call once per beforeEach.
 *
 * Pass test-specific overrides (fake stores, mock services, etc.) as the
 * optional argument — they are appended last so they shadow any default.
 */
export function configureTestBed(overrides: Provider[] = []): void {
  TestBed.configureTestingModule({
    providers: [
      ...appConfig.providers,
      provideHttpClientTesting(),
      { provide: TranslocoService, useValue: TRANSLOCO_STUB },
      ...overrides
    ]
  });
  setStaticDIInjector(TestBed.inject(Injector));
}
