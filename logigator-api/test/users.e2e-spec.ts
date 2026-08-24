import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { users } from '../src/database/schema';
import { CookieJar } from './cookie-jar';
import { startE2eApp, type E2eApp } from './harness';

/** An 8×8 PNG, so an avatar upload carries something a client would send. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADklEQVQYlWNgGAWgEAAAAQgAAa5MwN8AAAAASUVORK5CYII=',
  'base64'
);

/** Bytes libvips can open and this API still refuses to accept. */
const SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>'
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
    // The upload ceiling at its floor, so the oversized-avatar case is a couple
    // of kilobytes instead of five megabytes of payload.
    api = await startE2eApp({ UPLOAD_MAX_BYTES: '1024' });

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

  it('changes the address only with the current password', async () => {
    // A session is not proof of intent here: whoever holds a stolen cookie could
    // otherwise move the account to their own mailbox, confirm it from there, and
    // reset the password — a takeover the owner's password never gates.
    const withoutProof = await api.inject({
      method: 'PATCH',
      url: '/api/user',
      headers: jar.headers(),
      payload: { email: 'ada@newmail.test' }
    });

    expect(withoutProof.statusCode).toBe(401);
    expect(withoutProof.json().code).toBe('invalid_credentials');
    expect(api.mail.sent).toHaveLength(0);
  });

  it('keeps the old address until the new one is confirmed', async () => {
    const response = await api.inject({
      method: 'PATCH',
      url: '/api/user',
      headers: jar.headers(),
      payload: {
        email: 'ada@newmail.test',
        currentPassword: credentials.password
      }
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
      payload: {
        email: 'grace@example.com',
        currentPassword: credentials.password
      }
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
      payload: {
        email: 'contested@example.com',
        currentPassword: credentials.password
      }
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
    // A second signed-in device, to watch what the change does to it.
    const phone = new CookieJar();
    phone.store(
      await api.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: credentials
      })
    );

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

    // Every other one does not: a password is changed because the old one is not
    // trusted any more, and the sessions it opened are exactly what that means.
    const onThePhone = await api.inject({
      method: 'GET',
      url: '/api/user',
      headers: phone.headers()
    });
    expect(onThePhone.statusCode).toBe(401);

    credentials.password = 'babbage99';
  });

  it('re-encodes an avatar into every variant it advertises', async () => {
    const upload = await multipart(PNG, 'me.png', 'image/png');
    const response = await api.inject({
      method: 'POST',
      url: '/api/user/avatar',
      headers: { ...jar.headers(), ...upload.headers },
      payload: upload.payload
    });

    expect(response.statusCode).toBe(201);
    const { avatar } = response.json();
    expect(avatar.length).toBeGreaterThan(0);

    for (const variant of avatar) {
      // Pointers to the static layer — sharded, and named after nothing the
      // client sent. That none of them is a `.png` is the upload being
      // re-encoded rather than stored: what arrived was one.
      expect(variant.url).toMatch(
        /^\/profile\/[0-9a-f]{2}\/[0-9a-f-]{36}\/\d+\.(webp|jpg)$/
      );
      // What the response promises has to be on the volume, or the client is
      // holding URLs that 404.
      const file = await stat(join(api.env.STORAGE_DIR, variant.url));
      expect(file.size).toBeGreaterThan(0);
    }

    const removed = await api.inject({
      method: 'DELETE',
      url: '/api/user/avatar',
      headers: jar.headers()
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json().avatar).toBeNull();
    await expect(
      stat(join(api.env.STORAGE_DIR, avatar[0].url))
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  /**
   * The declared part type is the client's word for what it sent, and an
   * endpoint that trusts it serves whatever the client chose under whatever type
   * the client chose. What the file is gets decided by decoding it.
   */
  it.each([
    ['for what they are', 'image/svg+xml', 'me.svg'],
    ['when they claim to be a PNG', 'image/png', 'me.png']
  ])('refuses bytes it will not serve, %s', async (_, type, filename) => {
    const upload = await multipart(SVG, filename, type);

    const response = await api.inject({
      method: 'POST',
      url: '/api/user/avatar',
      headers: { ...jar.headers(), ...upload.headers },
      payload: upload.payload
    });

    expect(response.statusCode).toBe(415);
  });

  it('refuses an image over the upload ceiling', async () => {
    const upload = await multipart(
      Buffer.alloc(api.env.UPLOAD_MAX_BYTES + 1, 1),
      'huge.png',
      'image/png'
    );

    const response = await api.inject({
      method: 'POST',
      url: '/api/user/avatar',
      headers: { ...jar.headers(), ...upload.headers },
      payload: upload.payload
    });

    // A file too large is the client's business to fix, not a server fault: the
    // multipart plugin's own way of reporting it is an error that reads as neither
    // unless it is turned off and the truncation flag read instead.
    expect(response.statusCode).toBe(413);
    expect(response.json().code).toBe('bad_request');
  });

  it('deletes the account with its password, and not without', async () => {
    const withoutProof = await api.inject({
      method: 'DELETE',
      url: '/api/user',
      headers: jar.headers(),
      payload: {}
    });
    expect(withoutProof.statusCode).toBe(401);

    // And with no body at all — the natural call for an account that has no
    // password to send, which must reach the handler rather than fail validation.
    const bodyless = await api.inject({
      method: 'DELETE',
      url: '/api/user',
      headers: jar.headers()
    });
    expect(bodyless.statusCode).toBe(401);
    expect(bodyless.json().code).toBe('invalid_credentials');

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
