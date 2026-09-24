import { Provider, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {
  TRANSLOCO_MISSING_HANDLER,
  TranslocoMissingHandler
} from '@jsverse/transloco';
import type { UserResponse } from '@logigator/contract';
import { appConfig } from '../app/app.config';
import { SessionService } from '../app/user/session.service';

/**
 * Returns the key like the default handler, but without the console warning:
 * the locale table loads through a dynamic import, so anything rendered before
 * it resolves would warn about keys that do exist.
 */
class SilentTranslocoMissingHandler implements TranslocoMissingHandler {
  public handle(key: string): string {
    return key;
  }
}

/**
 * Resolves to no user without a request. The real one runs as an app
 * initializer, so every spec would otherwise open with an API call it has not
 * arranged for; the resolution itself is tested directly.
 */
class AnonymousSessionService {
  private readonly _user = signal<UserResponse | null>(null);
  public readonly user = this._user.asReadonly();

  public resolve(): Promise<void> {
    return Promise.resolve();
  }

  public signedIn(user: UserResponse): void {
    this._user.set(user);
  }
}

/**
 * Configures TestBed with the application's own provider set plus an HTTP
 * testing backend. Call once per `beforeEach`.
 *
 * Transloco is real rather than stubbed because a stub cannot drive the
 * `*webTranslate` directive components render, so component specs route through
 * here too, passing the components under test via `imports`.
 *
 * @param overrides test-specific providers, appended last so they shadow any
 *   default.
 * @param imports standalone components/directives to declare for the test.
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
      { provide: SessionService, useClass: AnonymousSessionService },
      ...overrides
    ]
  });
}
