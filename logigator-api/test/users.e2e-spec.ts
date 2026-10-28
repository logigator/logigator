import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { users } from '../src/database/schema';
import { assetFilePath } from './assets';
import { CookieJar } from './cookie-jar';
import { startE2eApp, type E2eApp } from './harness';
import { whileRowLocked } from './row-lock';

/** An 8×8 PNG, so an avatar upload carries something a client would send. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADklEQVQYlWNgGAWgEAAAAQgAAa5MwN8AAAAASUVORK5CYII=',
  'base64'
);

/** Bytes libvips can open and this API still refuses to accept. */
const SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>'
);

/** A file upload as a browser sends it, encoded by Node's own `Request`. */
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
    // The upload ceiling at its floor, so the oversized case costs kilobytes.
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
    // A session is not proof of intent: a stolen cookie could otherwise move
    // the account to another mailbox, confirm from there and reset the
    // password, never meeting the owner's own.
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
      // A typo must not lock its owner out, so nothing moves until the mail is
      // opened.
      user: { email: credentials.email },
      emailVerificationSent: true
    });
    expect(api.mail.last().to).toBe('ada@newmail.test');
    expect(api.mail.last().subject).toBe('Confirm your new email address');

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
    // The token lives an hour, long enough for somebody else to register the
    // address. The unique constraint has to read as a conflict, not a crash.
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

  it('caps the address changes one account asks for, and only those', async () => {
    // Two accounts on one client address, the way a classroom arrives.
    const signedIn = async (username: string, email: string) => {
      await api.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username, email, password: 'hopper123' }
      });
      await api.inject({
        method: 'POST',
        url: '/api/auth/verify-email',
        payload: { token: api.mail.lastToken() }
      });
      const account = new CookieJar();
      account.store(
        await api.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { email, password: 'hopper123' }
        })
      );
      return account;
    };
    const restless = await signedIn('Restless', 'restless@example.com');
    const neighbour = await signedIn('Neighbour', 'neighbour@example.com');
    api.mail.clear();

    const changeAddress = (account: CookieJar, email: string) =>
      api.inject({
        method: 'PATCH',
        url: '/api/user',
        headers: account.headers(),
        payload: { email, currentPassword: 'hopper123' }
      });

    for (let attempt = 1; attempt <= 5; attempt++) {
      const response = await changeAddress(
        restless,
        `restless${attempt}@example.com`
      );
      expect(response.statusCode).toBe(200);
    }
    expect(api.mail.sent).toHaveLength(5);

    const refused = await changeAddress(restless, 'restless6@example.com');
    expect(refused.statusCode).toBe(429);
    expect(refused.json().code).toBe('rate_limited');
    expect(api.mail.sent).toHaveLength(5);

    // An update that mails nobody is no change of address.
    const renamed = await api.inject({
      method: 'PATCH',
      url: '/api/user',
      headers: restless.headers(),
      payload: {
        username: 'Settled',
        email: 'restless@example.com',
        currentPassword: 'hopper123'
      }
    });
    expect(renamed.statusCode).toBe(200);

    expect(
      (await changeAddress(neighbour, 'neighbour2@example.com')).statusCode
    ).toBe(200);
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

    // The session survives its own password change: the credential changed,
    // not the identity.
    const stillSignedIn = await api.inject({
      method: 'GET',
      url: '/api/user',
      headers: jar.headers()
    });
    expect(stillSignedIn.statusCode).toBe(200);

    // Every other one ends: a password is changed because the old one is no
    // longer trusted, and so are the sessions it opened.
    const onThePhone = await api.inject({
      method: 'GET',
      url: '/api/user',
      headers: phone.headers()
    });
    expect(onThePhone.statusCode).toBe(401);

    credentials.password = 'babbage99';
  });

  describe('the profile fields', () => {
    /** Reads the account back, so what is asserted is what was stored. */
    const readBack = async () => {
      const response = await api.inject({
        method: 'GET',
        url: '/api/user',
        headers: jar.headers()
      });
      return response.json();
    };

    it('stores a bio with the invisibles taken out of it', async () => {
      const response = await api.inject({
        method: 'PATCH',
        url: '/api/user',
        headers: jar.headers(),
        payload: {
          // A bidi override and a zero-width space: the two ways stored text
          // and drawn text are made to disagree. Neither reaches the column.
          bio: 'I maintain SAFE\u202etxt.exe and zero\u200bwidth things'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().user.bio).toBe(
        'I maintain SAFEtxt.exe and zerowidth things'
      );
    });

    it('refuses an oversized bio rather than letting the column do it', async () => {
      const response = await api.inject({
        method: 'PATCH',
        url: '/api/user',
        headers: jar.headers(),
        payload: { bio: 'a'.repeat(1025) }
      });

      // The contract refuses it, so it is the suite's usual 422 rather than
      // the 500 a varchar overflow would answer with.
      expect(response.statusCode).toBe(422);
    });

    it('stores the links as submitted and answers them classified', async () => {
      const response = await api.inject({
        method: 'PATCH',
        url: '/api/user',
        headers: jar.headers(),
        payload: {
          bio: '  Relay logic and old microprocessors.  ',
          websiteUrl: 'https://Ada.Example/blog?utm_source=mail&page=2',
          socialLinks: [
            'https://GitHub.com/Ada?utm_campaign=profile',
            'https://unknown.example/me',
            'https://youtu.be/dQw4w9WgXcQ?si=share&t=30'
          ]
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().user).toMatchObject({
        bio: 'Relay logic and old microprocessors.',
        websiteUrl: 'https://ada.example/blog?page=2',
        socialLinks: [
          { url: 'https://github.com/Ada', platform: 'github' },
          { url: 'https://unknown.example/me', platform: 'other' },
          // `si` is the share sheet's attribution and `t` is where in the
          // video the link starts — one goes, one stays.
          { url: 'https://youtu.be/dQw4w9WgXcQ?t=30', platform: 'youtube' }
        ]
      });

      // The stored form is the normalized one, and the platform is not in the
      // row: it is derived from the host on the way out.
      await expect(readBack()).resolves.toMatchObject({
        websiteUrl: 'https://ada.example/blog?page=2',
        socialLinks: [
          { url: 'https://github.com/Ada', platform: 'github' },
          { url: 'https://unknown.example/me', platform: 'other' },
          { url: 'https://youtu.be/dQw4w9WgXcQ?t=30', platform: 'youtube' }
        ]
      });
    });

    it('refuses a link it would not hand to a reader', async () => {
      for (const url of [
        'javascript:alert(1)',
        'data:text/html,<script>x</script>',
        // Reads as a GitHub link; the host is the part after the `@`.
        'https://github.com@evil.example/x',
        '//github.com/ada',
        'github.com/ada'
      ]) {
        const response = await api.inject({
          method: 'PATCH',
          url: '/api/user',
          headers: jar.headers(),
          payload: { socialLinks: [url] }
        });

        expect(response.statusCode).toBe(422);
        // Named down to the slot: the field's own message would say nothing
        // about which of three links was refused.
        expect(Object.keys(response.json().details)).toEqual(['socialLinks.0']);
      }
    });

    it('holds three links, duplicates and all', async () => {
      const url = 'https://codeberg.org/ada';
      const stored = await api.inject({
        method: 'PATCH',
        url: '/api/user',
        headers: jar.headers(),
        payload: { socialLinks: [url, url, url] }
      });
      expect(stored.statusCode).toBe(200);
      expect((await readBack()).socialLinks).toEqual([
        { url, platform: 'codeberg' },
        { url, platform: 'codeberg' },
        { url, platform: 'codeberg' }
      ]);

      const tooMany = await api.inject({
        method: 'PATCH',
        url: '/api/user',
        headers: jar.headers(),
        payload: { socialLinks: [url, url, url, url] }
      });
      expect(tooMany.statusCode).toBe(422);
    });

    it('clears a field without touching the others', async () => {
      await api.inject({
        method: 'PATCH',
        url: '/api/user',
        headers: jar.headers(),
        payload: {
          bio: 'Ada',
          websiteUrl: 'https://ada.example/',
          socialLinks: ['https://github.com/ada']
        }
      });

      const cleared = await api.inject({
        method: 'PATCH',
        url: '/api/user',
        headers: jar.headers(),
        payload: { websiteUrl: null, socialLinks: [] }
      });

      expect(cleared.statusCode).toBe(200);
      expect(cleared.json().user).toMatchObject({
        // Nulled and emptied, which is how a field is removed: the patch is
        // partial, so what the body does not mention it does not touch.
        websiteUrl: null,
        socialLinks: [],
        bio: 'Ada'
      });
    });

    it('refuses a write against a profile saved since it was read', async () => {
      const { profileVersion } = await readBack();

      const first = await api.inject({
        method: 'PATCH',
        url: '/api/user',
        headers: jar.headers(),
        payload: { bio: 'From the first tab', profileVersion }
      });
      expect(first.statusCode).toBe(200);
      expect(first.json().user.profileVersion).toBe(profileVersion + 1);

      // The second tab drew its form from the same read.
      const second = await api.inject({
        method: 'PATCH',
        url: '/api/user',
        headers: jar.headers(),
        payload: { bio: 'From the second tab', profileVersion }
      });

      expect(second.statusCode).toBe(409);
      expect(second.json().code).toBe('version_conflict');
      expect((await readBack()).bio).toBe('From the first tab');
    });

    it('refuses a stale write that reaches the row after another one', async () => {
      const { id, profileVersion } = await readBack();

      // The request's own read of the account sees the old version, so only
      // the guarded statement can notice the write that committed under it.
      const response = await whileRowLocked(
        api.db,
        (tx) =>
          tx
            .update(users)
            .set({
              bio: 'From the other tab',
              profileVersion: sql`${users.profileVersion} + 1`
            })
            .where(eq(users.id, id)),
        () =>
          api.inject({
            method: 'PATCH',
            url: '/api/user',
            headers: jar.headers(),
            payload: { bio: 'From this tab', profileVersion }
          })
      );

      expect(response.statusCode).toBe(409);
      expect(response.json().code).toBe('version_conflict');
      expect((await readBack()).bio).toBe('From the other tab');
    });
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
      // Sharded, named after nothing the client sent, and not a `.png` —
      // the upload was re-encoded rather than stored, and a PNG arrived.
      expect(variant.url).toMatch(
        /^\/files\/profile\/[0-9a-f]{2}\/[0-9a-f-]{36}\/\d+\.webp$/
      );
      // What the response promises has to be on the volume.
      const file = await stat(assetFilePath(api, variant.url));
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
   * The declared part type is the client's word. What the file is gets decided
   * by decoding it.
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

    // Too large is the client's fault, not the server's — the multipart
    // plugin's own error reads as neither, so it is off and the truncation flag
    // is read instead.
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

    // No body at all is the natural call for an account with no password to
    // send, and must reach the handler rather than fail validation.
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

/**
 * The proof of identity deletion, a new password and a new address take: the
 * password where the account has one, and a sign-in a few minutes old where it
 * does not. The clock is the only thing moved, so the session is the one a
 * browser would hold.
 */
describe('changes that need more than a session', () => {
  let api: E2eApp;
  const password = 'babbage42';
  const elevenMinutes = 11 * 60 * 1000;

  async function register(email: string, username: string): Promise<void> {
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
  }

  async function signIn(email: string, jar = new CookieJar()) {
    jar.store(
      await api.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: jar.headers(),
        payload: { email, password }
      })
    );
    return jar;
  }

  /** Signed in with a password, which is then taken away: the state of an
   * account that only ever signed in through Google. */
  async function passwordlessAccount(email: string, username: string) {
    await register(email, username);
    const jar = await signIn(email);
    await api.db
      .update(users)
      .set({ passwordHash: null })
      .where(eq(users.email, email));
    return jar;
  }

  function update(jar: CookieJar, payload: object) {
    return api.inject({
      method: 'PATCH',
      url: '/api/user',
      headers: jar.headers(),
      payload
    });
  }

  async function storedRow(email: string) {
    const [row] = await api.db
      .select()
      .from(users)
      .where(eq(users.email, email));
    return row;
  }

  function elevenMinutesLater(): void {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + elevenMinutes);
  }

  function deleteAccount(jar: CookieJar, payload?: object) {
    return api.inject({
      method: 'DELETE',
      url: '/api/user',
      headers: jar.headers(),
      ...(payload ? { payload } : {})
    });
  }

  async function exists(email: string): Promise<boolean> {
    return (await storedRow(email)) !== undefined;
  }

  beforeAll(async () => {
    api = await startE2eApp();
  });

  afterAll(async () => {
    await api.close();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('takes a session that signed in moments ago where there is no password', async () => {
    const jar = await passwordlessAccount('fresh@example.com', 'Fresh');

    const response = await deleteAccount(jar);

    expect(response.statusCode).toBe(204);
    expect(await exists('fresh@example.com')).toBe(false);
  });

  it('asks an older session without a password to sign in again', async () => {
    const jar = await passwordlessAccount('stale@example.com', 'Stale');
    elevenMinutesLater();

    const response = await deleteAccount(jar);

    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe('reauthentication_required');
    expect(await exists('stale@example.com')).toBe(true);
    // Refused, not signed out: the session is still the way back to Google.
    const account = await api.inject({
      method: 'GET',
      url: '/api/user',
      headers: jar.headers()
    });
    expect(account.statusCode).toBe(200);
  });

  it('takes the password at any age of the session', async () => {
    await register('password@example.com', 'Password');
    const jar = await signIn('password@example.com');
    elevenMinutesLater();

    const response = await deleteAccount(jar, { password });

    expect(response.statusCode).toBe(204);
    expect(await exists('password@example.com')).toBe(false);
  });

  it('sets a first password from a session that signed in moments ago', async () => {
    const jar = await passwordlessAccount('first@example.com', 'First');

    const response = await update(jar, { password: 'turing1936' });

    expect(response.statusCode).toBe(200);
    expect(response.json().user.hasPassword).toBe(true);
  });

  it('asks an older session to sign in again before setting a first password', async () => {
    // Otherwise a stolen cookie sets a password and signs in with it for good.
    const jar = await passwordlessAccount('lateset@example.com', 'LateSet');
    elevenMinutesLater();

    const response = await update(jar, { password: 'turing1936' });

    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe('reauthentication_required');
    expect((await storedRow('lateset@example.com'))?.passwordHash).toBeNull();
  });

  it('moves the address of an account without a password from a fresh sign-in', async () => {
    const jar = await passwordlessAccount('moving@example.com', 'Moving');

    const response = await update(jar, { email: 'moved@example.com' });

    expect(response.statusCode).toBe(200);
    expect(response.json().emailVerificationSent).toBe(true);
    expect(api.mail.last().to).toBe('moved@example.com');
  });

  it('asks an older session without a password to sign in again before moving the address', async () => {
    const jar = await passwordlessAccount('latemove@example.com', 'LateMove');
    api.mail.clear();
    elevenMinutesLater();

    const response = await update(jar, { email: 'elsewhere@example.com' });

    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe('reauthentication_required');
    expect(api.mail.sent).toHaveLength(0);
  });

  it('takes the current password for a new address and password at any age of the session', async () => {
    await register('keeper@example.com', 'Keeper');
    const jar = await signIn('keeper@example.com');
    api.mail.clear();
    elevenMinutesLater();

    const response = await update(jar, {
      email: 'kept@example.com',
      password: 'turing1936',
      currentPassword: password
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().emailVerificationSent).toBe(true);
    expect(api.mail.last().to).toBe('kept@example.com');
  });

  it('ends the session a signed-in browser signs in again over', async () => {
    await register('twice@example.com', 'Twice');
    const jar = await signIn('twice@example.com');
    const before = jar.headers();

    await signIn('twice@example.com', jar);

    const old = await api.inject({
      method: 'GET',
      url: '/api/user',
      headers: before
    });
    expect(old.statusCode).toBe(401);
    const current = await api.inject({
      method: 'GET',
      url: '/api/user',
      headers: jar.headers()
    });
    expect(current.statusCode).toBe(200);
  });
});

/**
 * A session proves itself with the password through the same wrong-password
 * budgets as a sign-in, so a stolen session cookie is no way around them.
 * Each test makes its guesses from addresses of its own.
 */
describe('wrong passwords from a signed-in session', () => {
  let api: E2eApp;
  const password = 'hamilton69';

  async function signedInAccount(
    email: string,
    username: string
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
    const jar = new CookieJar();
    jar.store(await login('192.0.2.200', email, password));
    return jar;
  }

  function login(remoteAddress: string, email: string, attempt: string) {
    return api.inject({
      method: 'POST',
      url: '/api/auth/login',
      remoteAddress,
      payload: { email, password: attempt }
    });
  }

  /** Each of the account's password checks, in turn. */
  function proveWith(
    jar: CookieJar,
    remoteAddress: string,
    attempt: string,
    turn: number
  ) {
    const checks = [
      {
        method: 'PATCH',
        payload: { password: 'new-pass-1', currentPassword: attempt }
      },
      {
        method: 'PATCH',
        payload: { email: 'elsewhere@example.com', currentPassword: attempt }
      },
      { method: 'DELETE', payload: { password: attempt } }
    ] as const;
    const check = checks[turn % checks.length];
    return api.inject({
      method: check.method,
      url: '/api/user',
      headers: jar.headers(),
      remoteAddress,
      payload: check.payload
    });
  }

  beforeAll(async () => {
    api = await startE2eApp();
  });

  afterAll(async () => {
    await api.close();
  });

  it('locks the account’s password checks and its sign-in on that address after ten', async () => {
    const address = '198.51.100.10';
    const jar = await signedInAccount('margaret@example.com', 'Margaret');
    const other = await signedInAccount('katherine@example.com', 'Katherine');

    for (let turn = 0; turn < 10; turn += 1) {
      const wrong = await proveWith(jar, address, 'guess1234', turn);
      expect(wrong.statusCode).toBe(401);
      expect(wrong.json().code).toBe('invalid_credentials');
    }

    // The right password is refused too, through every check and the sign-in.
    const deletion = await proveWith(jar, address, password, 2);
    expect(deletion.statusCode).toBe(429);
    expect(deletion.json().code).toBe('rate_limited');
    expect((await proveWith(jar, address, password, 0)).statusCode).toBe(429);
    expect(
      (await login(address, 'margaret@example.com', password)).statusCode
    ).toBe(429);

    const stillThere = await api.inject({
      method: 'GET',
      url: '/api/user',
      headers: jar.headers()
    });
    expect(stillThere.statusCode).toBe(200);

    // Another account on the same address is untouched.
    expect(
      (await login(address, 'katherine@example.com', password)).statusCode
    ).toBe(200);
    const changed = await api.inject({
      method: 'PATCH',
      url: '/api/user',
      headers: other.headers(),
      remoteAddress: address,
      payload: { password: 'new-pass-1', currentPassword: password }
    });
    expect(changed.statusCode).toBe(200);
  });

  it('counts a session’s wrong passwords across addresses, and the sign-in’s on each', async () => {
    const jar = await signedInAccount('grace@example.com', 'Grace');

    // Nine wrong sign-ins and one wrong check on one address spend it.
    for (let attempt = 0; attempt < 9; attempt += 1) {
      expect(
        (await login('198.51.100.20', 'grace@example.com', 'guess1234'))
          .statusCode
      ).toBe(401);
    }
    expect(
      (await proveWith(jar, '198.51.100.20', 'guess1234', 0)).statusCode
    ).toBe(401);
    expect(
      (await proveWith(jar, '198.51.100.20', password, 0)).statusCode
    ).toBe(429);

    // Nine more checks, each from an address of its own, spend the account's.
    for (let turn = 1; turn < 10; turn += 1) {
      const wrong = await proveWith(
        jar,
        `198.51.100.${20 + turn}`,
        'guess1234',
        turn
      );
      expect(wrong.statusCode).toBe(401);
    }
    expect(
      (await proveWith(jar, '198.51.100.40', password, 0)).statusCode
    ).toBe(429);

    // A sign-in from an untouched address still goes through: only the
    // account's sessions share a budget across addresses.
    expect(
      (await login('198.51.100.40', 'grace@example.com', password)).statusCode
    ).toBe(200);
  });
});
