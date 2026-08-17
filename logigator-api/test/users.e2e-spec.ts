import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { users } from '../src/database/schema';
import { CookieJar } from './cookie-jar';
import { startE2eApp, type E2eApp } from './harness';

/** A 1×1 PNG, so an avatar upload carries something a client would send. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * Serializes a file upload the way a browser does. Node's `Request` does the
 * multipart encoding, boundary included, so the specs do not hand-roll one.
 */
async function multipart(
  content: Buffer,
  filename: string,
  type: string
): Promise<{ headers: Record<string, string>; payload: Buffer }> {
  const form = new FormData();
  form.set('file', new Blob([new Uint8Array(content)], { type }), filename);
  const request = new Request('http://localhost', {
    method: 'POST',
    body: form
  });

  return {
    headers: { 'content-type': request.headers.get('content-type') as string },
    payload: Buffer.from(await request.arrayBuffer())
  };
}

describe('the signed-in user', () => {
  let api: E2eApp;
  let jar: CookieJar;

  const credentials = { email: 'ada@example.com', password: 'lovelace1' };

  beforeAll(async () => {
    api = await startE2eApp();

    await api.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'Ada', ...credentials }
    });
    await api.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      payload: { token: api.mail.lastToken() }
    });

    jar = new CookieJar();
    jar.store(
      await api.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: credentials
      })
    );
  });

  afterAll(async () => {
    await api.close();
  });

  beforeEach(() => {
    api.mail.clear();
  });

  it('is unreachable without a session', async () => {
    const response = await api.inject({ method: 'GET', url: '/api/user' });

    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe('unauthorized');
  });

  it('renames itself', async () => {
    const response = await api.inject({
      method: 'PATCH',
      url: '/api/user',
      headers: jar.headers(),
      payload: { username: 'Ada_L' }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      user: { username: 'Ada_L' },
      emailVerificationSent: false
    });
  });

  it('rejects a username the legacy rules rejected too', async () => {
    const response = await api.inject({
      method: 'PATCH',
      url: '/api/user',
      headers: jar.headers(),
      payload: { username: 'ada lovelace!' }
    });

    expect(response.statusCode).toBe(422);
    expect(Object.keys(response.json().details)).toEqual(['username']);
  });

  it('keeps the old address until the new one is confirmed', async () => {
    const response = await api.inject({
      method: 'PATCH',
      url: '/api/user',
      headers: jar.headers(),
      payload: { email: 'ada@newmail.test' }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      // Unchanged: a typo in an address must not lock its owner out, so nothing
      // moves until the mail is opened.
      user: { email: credentials.email },
      emailVerificationSent: true
    });
    expect(api.mail.last().to).toBe('ada@newmail.test');
    expect(api.mail.last().subject).toBe('Verify your new email');

    const verification = await api.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      payload: { token: api.mail.lastToken() }
    });
    expect(verification.statusCode).toBe(204);

    const profile = await api.inject({
      method: 'GET',
      url: '/api/user',
      headers: jar.headers()
    });
    expect(profile.json().email).toBe('ada@newmail.test');
  });

  it('will not take an address another account holds', async () => {
    await api.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'Grace',
        email: 'grace@example.com',
        password: 'hopper123'
      }
    });

    const response = await api.inject({
      method: 'PATCH',
      url: '/api/user',
      headers: jar.headers(),
      payload: { email: 'grace@example.com' }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe('conflict');
  });

  it('refuses a confirmation whose address was taken meanwhile', async () => {
    // The address is free when the mail goes out, and the token lives an hour —
    // long enough for somebody else to register it. The unique constraint is
    // where that is noticed, and it has to read as a conflict, not a crash.
    const change = await api.inject({
      method: 'PATCH',
      url: '/api/user',
      headers: jar.headers(),
      payload: { email: 'contested@example.com' }
    });
    expect(change.statusCode).toBe(200);
    const token = api.mail.lastToken();

    await api.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'Squatter',
        email: 'contested@example.com',
        password: 'firstcome1'
      }
    });

    const confirmation = await api.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      payload: { token }
    });

    expect(confirmation.statusCode).toBe(409);
    expect(confirmation.json().code).toBe('conflict');
  });

  it('changes the password only with the current one', async () => {
    const withoutProof = await api.inject({
      method: 'PATCH',
      url: '/api/user',
      headers: jar.headers(),
      payload: { password: 'babbage99' }
    });
    expect(withoutProof.statusCode).toBe(401);
    expect(withoutProof.json().code).toBe('invalid_credentials');

    const wrongProof = await api.inject({
      method: 'PATCH',
      url: '/api/user',
      headers: jar.headers(),
      payload: { password: 'babbage99', currentPassword: 'not-it-1' }
    });
    expect(wrongProof.statusCode).toBe(401);

    const changed = await api.inject({
      method: 'PATCH',
      url: '/api/user',
      headers: jar.headers(),
      payload: {
        password: 'babbage99',
        currentPassword: credentials.password
      }
    });
    expect(changed.statusCode).toBe(200);

    // The session survives its own password change — it is the credential that
    // changed, not the identity.
    const stillSignedIn = await api.inject({
      method: 'GET',
      url: '/api/user',
      headers: jar.headers()
    });
    expect(stillSignedIn.statusCode).toBe(200);
    credentials.password = 'babbage99';
  });

  it('stores an avatar and serves its URL', async () => {
    const upload = await multipart(PNG, 'me.png', 'image/png');
    const response = await api.inject({
      method: 'POST',
      url: '/api/user/avatar',
      headers: { ...jar.headers(), ...upload.headers },
      payload: upload.payload
    });

    expect(response.statusCode).toBe(201);
    const { avatarUrl } = response.json();
    // A pointer to the static layer, not the file's bytes or its internal name.
    expect(avatarUrl).toMatch(/^\/profile\/[\w-]+\.png$/);

    const removed = await api.inject({
      method: 'DELETE',
      url: '/api/user/avatar',
      headers: jar.headers()
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json().avatarUrl).toBeNull();
  });

  it('refuses a file type it will not serve', async () => {
    const upload = await multipart(
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      'me.svg',
      'image/svg+xml'
    );

    const response = await api.inject({
      method: 'POST',
      url: '/api/user/avatar',
      headers: { ...jar.headers(), ...upload.headers },
      payload: upload.payload
    });

    expect(response.statusCode).toBe(415);
  });

  it('deletes the account with its password, and not without', async () => {
    const withoutProof = await api.inject({
      method: 'DELETE',
      url: '/api/user',
      headers: jar.headers(),
      payload: {}
    });
    expect(withoutProof.statusCode).toBe(401);

    const deleted = await api.inject({
      method: 'DELETE',
      url: '/api/user',
      headers: jar.headers(),
      payload: { password: credentials.password }
    });
    expect(deleted.statusCode).toBe(204);

    // Gone from the database, and the session with it.
    const rows = await api.db
      .select()
      .from(users)
      .where(eq(users.email, 'ada@newmail.test'));
    expect(rows).toHaveLength(0);

    const afterwards = await api.inject({
      method: 'GET',
      url: '/api/user',
      headers: jar.headers()
    });
    expect(afterwards.statusCode).toBe(401);
  });
});
