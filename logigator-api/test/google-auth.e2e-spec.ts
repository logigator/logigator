import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { users } from '../src/database/schema';
import { CookieJar } from './cookie-jar';
import { startE2eApp, type E2eApp } from './harness';

/**
 * The parts of the OAuth round trip that never talk to Google: the refusal with
 * no credentials configured, and the failure redirect when a callback cannot
 * name a flow this server started. Past the state lookup it is
 * `openid-client`'s protocol work against a live provider, which belongs in a
 * manual pass.
 */
describe('Google sign-in when it is not configured', () => {
  let api: E2eApp;

  beforeAll(async () => {
    api = await startE2eApp();
  });

  afterAll(async () => {
    await api.close();
  });

  it('says so rather than pretending, and says so in the contract shape', async () => {
    const response = await api.inject({
      method: 'GET',
      url: '/api/auth/google'
    });

    expect(response.statusCode).toBe(501);
    expect(response.json()).toMatchObject({ code: 'internal' });
  });

  it('is absent from the providers clients draw their login form from', async () => {
    const meta = await api.inject({ method: 'GET', url: '/api/meta' });

    expect(meta.json().authProviders).toEqual(['local']);
  });
});

describe('Google sign-in callbacks', () => {
  let api: E2eApp;

  beforeAll(async () => {
    // Credentials only have to exist for the routes to be enabled.
    api = await startE2eApp({
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      OAUTH_RETURN_URL: 'http://logigator.test/login'
    });
  });

  afterAll(async () => {
    await api.close();
  });

  it('sends an unknown state back to the login page with a reason', async () => {
    const response = await api.inject({
      method: 'GET',
      url: '/api/auth/google/callback?code=whatever&state=never-issued'
    });

    // The state lookup fails before any token exchange is attempted.
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(
      'http://logigator.test/login?error=google_state_invalid'
    );
  });

  it('offers Google to clients once it is configured', async () => {
    const meta = await api.inject({ method: 'GET', url: '/api/meta' });

    expect(meta.json().authProviders).toEqual(['local', 'google']);
  });
});

describe('unlinking Google', () => {
  let api: E2eApp;

  const password = 'hopper42';

  /** There is no request that links an identity without a real round trip, so
   * the link is written the way the callback would have written it. */
  async function makeAccount(
    email: string,
    username: string,
    googleUserId: string
  ): Promise<CookieJar> {
    await api.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username, email, password }
    });
    await api.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      payload: { token: api.mail.lastToken() }
    });
    await api.db
      .update(users)
      .set({ googleUserId })
      .where(eq(users.email, email));

    return signIn(email);
  }

  async function signIn(email: string): Promise<CookieJar> {
    const jar = new CookieJar();
    jar.store(
      await api.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, password }
      })
    );
    return jar;
  }

  function unlink(jar: CookieJar) {
    return api.inject({
      method: 'DELETE',
      url: '/api/auth/google',
      headers: jar.headers()
    });
  }

  function readAccount(jar: CookieJar) {
    return api.inject({
      method: 'GET',
      url: '/api/user',
      headers: jar.headers()
    });
  }

  beforeAll(async () => {
    api = await startE2eApp({
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      OAUTH_RETURN_URL: 'http://logigator.test/login'
    });
  });

  afterAll(async () => {
    await api.close();
  });

  it('needs a session of its own', async () => {
    const response = await api.inject({
      method: 'DELETE',
      url: '/api/auth/google'
    });

    expect(response.statusCode).toBe(401);
  });

  it('detaches the identity and ends the sessions it opened, sparing this one', async () => {
    const jar = await makeAccount(
      'grace@example.com',
      'Grace',
      'google-sub-grace'
    );
    const elsewhere = await signIn('grace@example.com');

    const response = await unlink(jar);

    expect(response.statusCode).toBe(200);
    expect(response.json().googleLinked).toBe(false);
    // The credential set changed, so the sessions it opened go with it — the
    // store indexes by account, so the rule is all of them but the caller's.
    expect((await readAccount(elsewhere)).statusCode).toBe(401);
    expect((await readAccount(jar)).statusCode).toBe(200);
  });

  it('refuses while Google is the only way back in', async () => {
    // Signed in first, then the password taken away: an account with none has
    // nothing to log in with, so its session has to exist already.
    const jar = await makeAccount(
      'alan@example.com',
      'Alan',
      'google-sub-alan'
    );
    await api.db
      .update(users)
      .set({ passwordHash: null })
      .where(eq(users.email, 'alan@example.com'));

    const response = await unlink(jar);

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe('conflict');
    // Refused rather than half-done: the identity is still on the account.
    expect((await readAccount(jar)).json().googleLinked).toBe(true);
  });
});
