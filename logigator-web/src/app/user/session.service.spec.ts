import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  makeStateKey,
  provideZonelessChangeDetection,
  TransferState
} from '@angular/core';
import { SessionService } from './session.service';

function setHint(value: string | null): void {
  if (value === null) {
    document.cookie =
      'isAuthenticated=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    return;
  }
  document.cookie = `isAuthenticated=${value};path=/`;
}

const USER = {
  id: '00000000-0000-4000-8000-000000000000',
  username: 'ada',
  email: 'ada@example.com',
  emailVerified: true,
  avatar: null,
  memberSince: '2026-01-01T00:00:00.000Z',
  hasPassword: true,
  googleLinked: false
};

const SESSION_STATE = makeStateKey<unknown>('session.user');

describe('SessionService', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    setHint(null);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
    setHint(null);
  });

  it('spends no request on a visitor with no session', async () => {
    // The hint cookie exists so an anonymous page view does not pay for a
    // guaranteed 401 — on the server render that cost is on the page itself.
    await TestBed.inject(SessionService).resolve();

    expect(TestBed.inject(SessionService).user()).toBeNull();
  });

  it('resolves the account the hint cookie claims', async () => {
    setHint('true');
    const session = TestBed.inject(SessionService);

    const resolved = session.resolve();
    http.expectOne('/api/user').flush(USER);
    await resolved;

    expect(session.user()?.username).toBe('ada');
  });

  it('clears a hint the API rejects', async () => {
    // The session behind it is gone; leaving the cookie would make every later
    // page view repeat the same 401.
    setHint('true');
    const session = TestBed.inject(SessionService);

    const resolved = session.resolve();
    http
      .expectOne('/api/user')
      .flush(
        { code: 'unauthorized', message: 'no session' },
        { status: 401, statusText: 'Unauthorized' }
      );
    await resolved;

    expect(session.user()).toBeNull();
    expect(document.cookie).not.toContain('isAuthenticated=true');
  });

  it('takes the account from the server render rather than asking again', async () => {
    // The render already spent a request, with the session cookie forwarded;
    // repeating it after hydration is what would make the page flicker.
    setHint('true');
    TestBed.inject(TransferState).set(SESSION_STATE, USER);
    const session = TestBed.inject(SessionService);

    await session.resolve();

    expect(session.user()?.username).toBe('ada');
  });

  it('consumes the hand-off, so a later resolve asks the API', async () => {
    setHint('true');
    TestBed.inject(TransferState).set(SESSION_STATE, USER);
    const session = TestBed.inject(SessionService);
    await session.resolve();

    const resolved = session.resolve();
    http.expectOne('/api/user').flush({ ...USER, username: 'grace' });
    await resolved;

    expect(session.user()?.username).toBe('grace');
  });

  it('keeps the hint when the API is merely unreachable', async () => {
    // A 5xx or an offline browser says nothing about the session, and clearing
    // the hint would sign the visitor out of a session that is still valid.
    setHint('true');
    const session = TestBed.inject(SessionService);

    const resolved = session.resolve();
    http
      .expectOne('/api/user')
      .flush('', { status: 503, statusText: 'Service Unavailable' });
    await resolved;

    expect(document.cookie).toContain('isAuthenticated=true');
  });
});
