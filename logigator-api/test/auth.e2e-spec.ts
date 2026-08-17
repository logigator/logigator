import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { userResponseSchema } from '@logigator/contract';
import { CookieJar } from './cookie-jar';
import { startE2eApp, type E2eApp } from './harness';

const CREDENTIALS = { email: 'ada@example.com', password: 'lovelace1' };

describe('local authentication', () => {
  let api: E2eApp;

  beforeAll(async () => {
    api = await startE2eApp();
  });

  afterAll(async () => {
    await api.close();
  });

  beforeEach(() => {
    api.mail.clear();
  });

  /** Registers, opens the link from the mail, and returns nothing else. */
  async function registerAndVerify(
    email = CREDENTIALS.email,
    username = 'Ada'
  ): Promise<void> {
    const registration = await api.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username, email, password: CREDENTIALS.password }
    });
    expect(registration.statusCode).toBe(201);

    const token = api.mail.lastToken();
    const verification = await api.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      payload: { token }
    });
    expect(verification.statusCode).toBe(204);
  }

  async function login(
    jar: CookieJar,
    payload: { email: string; password: string } = CREDENTIALS
  ) {
    const response = await api.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: jar.headers(),
      payload
    });
    jar.store(response);
    return response;
  }

  it('mails a verification link to the address that registered', async () => {
    const response = await api.inject({
      method: 'POST',
      url: '/api/auth/register',
      // Registered in mixed case: PostgreSQL compares text exactly, so the
      // address has to be normalized on the way in or one mailbox gets two
      // accounts.
      payload: {
        username: 'Grace',
        email: 'Grace@Example.COM',
        password: 'hopper123'
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ verificationRequired: true });
    expect(api.mail.last().to).toBe('grace@example.com');
    expect(api.mail.last().subject).toBe('Welcome to Logigator');
  });

  it('refuses a second account for the same address, whatever its case', async () => {
    const response = await api.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'Grace2',
        email: 'grace@example.com',
        password: 'hopper123'
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe('conflict');
    expect(api.mail.sent).toHaveLength(0);
  });

  it('refuses to sign in until the address is confirmed', async () => {
    const response = await api.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'grace@example.com', password: 'hopper123' }
    });

    expect(response.statusCode).toBe(403);
    // Distinguished from a wrong password on purpose: it is the one failure the
    // client can offer to fix, by asking for the mail again.
    expect(response.json().code).toBe('email_not_verified');
  });

  it('signs in after verification and carries the session in a cookie', async () => {
    await registerAndVerify();
    const jar = new CookieJar();

    const response = await login(jar);

    expect(response.statusCode).toBe(200);
    expect(userResponseSchema.parse(response.json())).toMatchObject({
      username: 'Ada',
      email: CREDENTIALS.email,
      emailVerified: true,
      hasPassword: true,
      googleLinked: false,
      avatarUrl: null
    });

    const session = response.cookies.find((c) => c.name === 'lg_sid');
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite?.toLowerCase()).toBe('lax');

    // The hint cookie must stay readable to scripts: the editor drives its whole
    // signed-in state off it, and a login in another tab is noticed through it.
    const hint = response.cookies.find((c) => c.name === 'isAuthenticated');
    expect(hint?.value).toBe('true');
    expect(hint?.httpOnly).toBeFalsy();

    // The session is what authenticates, not the hint.
    const profile = await api.inject({
      method: 'GET',
      url: '/api/user',
      headers: jar.headers()
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json().email).toBe(CREDENTIALS.email);
  });

  it('gives the same answer for a wrong password and an unknown address', async () => {
    const wrongPassword = await api.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: CREDENTIALS.email, password: 'lovelace2' }
    });
    const unknownAddress = await api.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nobody@example.com', password: 'lovelace1' }
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownAddress.statusCode).toBe(401);
    // Identical bodies: whether an address has an account is not something this
    // endpoint answers.
    expect(unknownAddress.json()).toEqual(wrongPassword.json());
    expect(wrongPassword.json().code).toBe('invalid_credentials');
  });

  it('ends the session on logout, and the cookie stops working', async () => {
    const jar = new CookieJar();
    await login(jar);
    // What the browser holds at this moment, kept so it can be replayed after
    // the jar has been cleaned up by the logout response.
    const staleCookies = jar.header() as string;

    const logout = await api.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: jar.headers()
    });
    expect(logout.statusCode).toBe(204);

    jar.store(logout);
    // The hint is cleared, so a client reading only that agrees with the server.
    expect(jar.has('isAuthenticated')).toBe(false);

    // And the session is gone server-side, not merely dropped by the client:
    // replaying the cookie it held resolves to nothing.
    const replay = await api.inject({
      method: 'GET',
      url: '/api/user',
      headers: { cookie: staleCookies }
    });
    expect(replay.statusCode).toBe(401);
    expect(replay.json().code).toBe('unauthorized');
  });

  it('resets a password through the link, and the old one stops working', async () => {
    const request = await api.inject({
      method: 'POST',
      url: '/api/auth/password-reset',
      payload: { email: CREDENTIALS.email }
    });
    expect(request.statusCode).toBe(204);

    const token = api.mail.lastToken();
    const confirm = await api.inject({
      method: 'POST',
      url: '/api/auth/password-reset/confirm',
      payload: { token, password: 'babbage99' }
    });
    expect(confirm.statusCode).toBe(204);

    const withOld = await login(new CookieJar());
    expect(withOld.statusCode).toBe(401);

    const withNew = await login(new CookieJar(), {
      email: CREDENTIALS.email,
      password: 'babbage99'
    });
    expect(withNew.statusCode).toBe(200);
  });

  it('spends a reset link on first use', async () => {
    await api.inject({
      method: 'POST',
      url: '/api/auth/password-reset',
      payload: { email: CREDENTIALS.email }
    });
    const token = api.mail.lastToken();

    const first = await api.inject({
      method: 'POST',
      url: '/api/auth/password-reset/confirm',
      payload: { token, password: 'turing777' }
    });
    const replay = await api.inject({
      method: 'POST',
      url: '/api/auth/password-reset/confirm',
      payload: { token, password: 'someoneelse5' }
    });

    expect(first.statusCode).toBe(204);
    expect(replay.statusCode).toBe(400);
    expect(replay.json().code).toBe('token_invalid');
  });

  it('says nothing about whether an address has an account', async () => {
    const response = await api.inject({
      method: 'POST',
      url: '/api/auth/password-reset',
      payload: { email: 'nobody@example.com' }
    });

    expect(response.statusCode).toBe(204);
    expect(api.mail.sent).toHaveLength(0);
  });
});

describe('credential rate limiting', () => {
  let api: E2eApp;

  beforeAll(async () => {
    api = await startE2eApp();
  });

  afterAll(async () => {
    await api.close();
  });

  it('cuts off repeated attempts from one address', async () => {
    // Ten per ten minutes on the shared `credentials` budget, so the eleventh is
    // refused whether or not the address exists.
    const attempts = await Promise.all(
      Array.from({ length: 11 }, () =>
        api.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { email: 'nobody@example.com', password: 'guess1234' }
        })
      )
    );

    const statuses = attempts.map((response) => response.statusCode);
    expect(statuses.filter((status) => status === 401)).toHaveLength(10);
    expect(statuses.filter((status) => status === 429)).toHaveLength(1);
    expect(attempts.at(-1)?.json().code).toBe('rate_limited');
  });
});
