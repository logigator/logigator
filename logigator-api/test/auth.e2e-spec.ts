import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { userResponseSchema } from '@logigator/contract';
import { users } from '../src/database/schema';
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
      // PostgreSQL compares text exactly, so a mixed-case address has to be
      // normalized on the way in or one mailbox gets two accounts.
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
    // Distinguished from a wrong password: the one failure a client can offer
    // to fix, by asking for the mail again.
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
      avatar: null
    });

    const session = response.cookies.find((c) => c.name === 'lg_sid');
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite?.toLowerCase()).toBe('lax');

    // The hint must stay readable to scripts: the editor drives its signed-in
    // state off it, and notices a login in another tab through it.
    const hint = response.cookies.find((c) => c.name === 'isAuthenticated');
    expect(hint?.value).toBe('true');
    expect(hint?.httpOnly).toBeFalsy();
    // The instant the session cookie carries, not a lifetime computed a second
    // time: a hint that outlives the session it mirrors shows a signed-in shell
    // to a visitor the API has already forgotten.
    expect(hint?.expires).toBeInstanceOf(Date);
    expect(hint?.expires).toEqual(session?.expires);

    // The session is what authenticates, not the hint.
    const profile = await api.inject({
      method: 'GET',
      url: '/api/user',
      headers: jar.headers()
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json().email).toBe(CREDENTIALS.email);
  });

  it('slides the hint cookie with the session, and only for a session', async () => {
    const jar = new CookieJar();
    await login(jar);

    // The hint rides along on every response, as the `rolling` session cookie
    // does. Written once at sign-in it would expire under a live session, and
    // the client would show a signed-out shell to a signed-in user.
    const authenticated = await api.inject({
      method: 'GET',
      url: '/api/user',
      headers: jar.headers()
    });
    const refreshed = authenticated.cookies.find(
      (c) => c.name === 'isAuthenticated'
    );
    expect(refreshed?.value).toBe('true');
    const slid = authenticated.cookies.find((c) => c.name === 'lg_sid');
    expect(slid?.expires).toBeInstanceOf(Date);
    expect(refreshed?.expires).toEqual(slid?.expires);

    // A hint no session backs is cleared, correcting a client whose session
    // ended elsewhere — a password reset, or another tab.
    const stale = await api.inject({
      method: 'GET',
      url: '/api/user',
      headers: { cookie: 'isAuthenticated=true' }
    });
    expect(stale.statusCode).toBe(401);
    expect(stale.cookies.find((c) => c.name === 'isAuthenticated')?.value).toBe(
      ''
    );

    // A caller with no cookies is given none.
    const anonymous = await api.inject({ method: 'GET', url: '/api/meta' });
    expect(anonymous.cookies).toEqual([]);
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
    // Whether an address has an account is not something this endpoint says.
    expect(unknownAddress.json()).toEqual(wrongPassword.json());
    expect(wrongPassword.json().code).toBe('invalid_credentials');
  });

  it('ends the session on logout, and the cookie stops working', async () => {
    const jar = new CookieJar();
    await login(jar);
    // Kept so it can be replayed after the logout response empties the jar.
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
    // And so is the session cookie: `destroy` leaves `@fastify/session` nothing
    // to write, so unless it is cleared here the browser keeps sending a dead
    // id for another thirty days.
    expect(jar.has('lg_sid')).toBe(false);

    // Gone server-side, not merely dropped by the client: replaying the cookie
    // resolves to nothing.
    const replay = await api.inject({
      method: 'GET',
      url: '/api/user',
      headers: { cookie: staleCookies }
    });
    expect(replay.statusCode).toBe(401);
    expect(replay.json().code).toBe('unauthorized');
  });

  it('clears the cookies of a session whose account is gone', async () => {
    // A second session of the same account: the deleting response cleans up its
    // own cookies, and nothing has reached this one.
    await registerAndVerify('turing@example.com', 'Alan');
    const credentials = {
      email: 'turing@example.com',
      password: CREDENTIALS.password
    };
    const deleting = new CookieJar();
    const survivor = new CookieJar();
    await login(deleting, credentials);
    await login(survivor, credentials);

    const deletion = await api.inject({
      method: 'DELETE',
      url: '/api/user',
      headers: deleting.headers(),
      payload: { password: credentials.password }
    });
    expect(deletion.statusCode).toBe(204);

    const response = await api.inject({
      method: 'GET',
      url: '/api/user',
      headers: survivor.headers()
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe('unauthorized');

    // The session resolves to a row that no longer exists, so both cookies are
    // cleared — a hint left behind renders a signed-in shell for a gone
    // account.
    survivor.store(response);
    expect(survivor.has('lg_sid')).toBe(false);
    expect(survivor.has('isAuthenticated')).toBe(false);
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

  it('says nothing about it when the mail server is down either', async () => {
    // An unknown address has no mail that can fail, so a failure reaching the
    // caller would mark out every address that does have an account. Hence the
    // same 204 the spec above pins for an unknown address.
    api.mail.failNextSend = true;

    const response = await api.inject({
      method: 'POST',
      url: '/api/auth/password-reset',
      payload: { email: CREDENTIALS.email }
    });

    expect(response.statusCode).toBe(204);
    expect(api.mail.sent).toHaveLength(0);
  });
});

describe('accounts migrated from the legacy backend', () => {
  let api: E2eApp;

  /**
   * A row as the migration writes it: a legacy `bcrypt` hash at 9 salt rounds
   * and an already-verified address, reaching the database without passing
   * through the registration path.
   */
  const legacy = {
    username: 'Alan',
    email: 'alan@example.com',
    password: 'correct horse battery staple',
    hash: '$2b$09$18bH31m/iSlckJkNuwtz2.Lsp.hLj2qqcwFcgHaTzWmJS5zMLTWTe'
  };

  beforeAll(async () => {
    // Cost 12, above the legacy hash, so the login has a reason to rewrite it.
    api = await startE2eApp({ BCRYPT_COST: '12' });
    await api.db.insert(users).values({
      username: legacy.username,
      email: legacy.email,
      passwordHash: legacy.hash,
      emailVerified: true
    });
  });

  afterAll(async () => {
    await api.close();
  });

  it('signs in with its old password and strengthens the stored hash', async () => {
    const response = await api.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: legacy.email, password: legacy.password }
    });

    expect(response.statusCode).toBe(200);

    const [stored] = await api.db
      .select()
      .from(users)
      .where(eq(users.email, legacy.email));
    // Rewritten at the current cost — the one moment the password is known.
    expect(stored.passwordHash).not.toBe(legacy.hash);
    expect(stored.passwordHash?.startsWith('$2b$12$')).toBe(true);

    // And the account still belongs to the same password afterwards.
    const again = await api.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: legacy.email, password: legacy.password }
    });
    expect(again.statusCode).toBe(200);
  });
});

describe('what a password reset does to sessions', () => {
  let api: E2eApp;

  const credentials = { email: 'grete@example.com', password: 'hermann12' };

  beforeAll(async () => {
    api = await startE2eApp();

    await api.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'Grete', ...credentials }
    });
    await api.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      payload: { token: api.mail.lastToken() }
    });
  });

  afterAll(async () => {
    await api.close();
  });

  async function login(jar: CookieJar, password = credentials.password) {
    const response = await api.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: credentials.email, password }
    });
    jar.store(response);
    return response;
  }

  it('ends every one of them', async () => {
    const desktop = new CookieJar();
    const phone = new CookieJar();
    expect((await login(desktop)).statusCode).toBe(200);
    expect((await login(phone)).statusCode).toBe(200);

    await api.inject({
      method: 'POST',
      url: '/api/auth/password-reset',
      payload: { email: credentials.email }
    });
    const confirm = await api.inject({
      method: 'POST',
      url: '/api/auth/password-reset/confirm',
      payload: { token: api.mail.lastToken(), password: 'hedy12345' }
    });
    expect(confirm.statusCode).toBe(204);

    // A reset is what a compromised account gets, so sessions opened on the old
    // password have to end with it.
    for (const jar of [desktop, phone]) {
      const response = await api.inject({
        method: 'GET',
        url: '/api/user',
        headers: jar.headers()
      });
      expect(response.statusCode).toBe(401);
    }

    // And the account is reachable again, from the new password.
    expect((await login(new CookieJar(), 'hedy12345')).statusCode).toBe(200);
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
    // Ten per ten minutes on the shared `credentials` budget, whether or not
    // the address exists.
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
