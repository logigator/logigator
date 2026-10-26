import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  CachePurge,
  PurgeOutcome
} from '../src/storage/cache-purge/cache-purge';
import {
  CACHE_PURGE_SETTLE_MS,
  CachePurgeQueue
} from '../src/storage/cache-purge/cache-purge-queue';
import { OrphanSweepService } from '../src/storage/orphan-sweep.service';
import { CookieJar } from './cookie-jar';
import { startE2eApp, type E2eApp } from './harness';

/** An 8×8 PNG, for an avatar and both renders of a preview. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADklEQVQYlWNgGAWgEAAAAQgAAa5MwN8AAAAASUVORK5CYII=',
  'base64'
);

async function multipart(
  names: readonly string[]
): Promise<{ headers: Record<string, string>; payload: Buffer }> {
  const form = new FormData();
  for (const name of names) {
    form.set(
      name,
      new Blob([new Uint8Array(PNG)], { type: 'image/png' }),
      `${name}.png`
    );
  }
  const request = new Request('http://localhost', {
    method: 'POST',
    body: form
  });
  return {
    headers: { 'content-type': request.headers.get('content-type') as string },
    payload: Buffer.from(await request.arrayBuffer())
  };
}

/** Collects what reaches the CDN, without sending it anywhere. */
class RecordingPurge implements CachePurge {
  readonly name = 'recording';
  readonly batchSize = 100;
  private urls: string[] = [];

  purge(urls: readonly string[]): Promise<PurgeOutcome> {
    this.urls.push(...urls);
    return Promise.resolve({ ok: true });
  }

  take(): string[] {
    const taken = this.urls.sort();
    this.urls = [];
    return taken;
  }
}

describe('purging deleted files from the CDN', () => {
  const cdn = new RecordingPurge();
  let api: E2eApp;

  /** Everything purged since the last call, once every queued purge is due. */
  async function purged(): Promise<string[]> {
    await api.app
      .get(CachePurgeQueue)
      .drain(Date.now() + CACHE_PURGE_SETTLE_MS);
    return cdn.take();
  }

  /** Where the CDN caches what the API advertised. */
  function absolute(variants: readonly { url: string }[]): string[] {
    return variants.map(({ url }) => `http://logigator.test${url}`).sort();
  }

  async function signUp(username: string): Promise<CookieJar> {
    const credentials = {
      email: `${username.toLowerCase()}@example.com`,
      password: 'lovelace1'
    };
    await api.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username, ...credentials }
    });
    await api.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      payload: { token: api.mail.lastToken() }
    });
    const jar = new CookieJar();
    jar.store(
      await api.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: credentials
      })
    );
    return jar;
  }

  async function setAvatar(jar: CookieJar): Promise<{ url: string }[]> {
    const body = await multipart(['file']);
    const response = await api.inject({
      method: 'POST',
      url: '/api/user/avatar',
      headers: { ...jar.headers(), ...body.headers },
      payload: body.payload
    });
    expect(response.statusCode).toBe(201);
    return response.json().avatar;
  }

  async function createProject(jar: CookieJar): Promise<string> {
    const response = await api.inject({
      method: 'POST',
      url: '/api/projects',
      headers: jar.headers(),
      payload: { name: 'Previewed' }
    });
    expect(response.statusCode).toBe(201);
    return response.json().id;
  }

  async function setPreview(
    jar: CookieJar,
    id: string
  ): Promise<{ url: string }[]> {
    const body = await multipart(['light', 'dark']);
    const response = await api.inject({
      method: 'POST',
      url: `/api/projects/${id}/preview`,
      headers: { ...jar.headers(), ...body.headers },
      payload: body.payload
    });
    expect(response.statusCode).toBe(201);
    const { light, dark } = response.json().preview;
    return [...light, ...dark];
  }

  beforeAll(async () => {
    api = await startE2eApp(
      { STORAGE_SWEEP_GRACE_MINUTES: '0' },
      { cachePurge: cdn }
    );
  });

  afterAll(async () => {
    await api.close();
  });

  it('purges the avatar a new one replaces, then the one removed', async () => {
    const jar = await signUp('Ada');
    const first = await setAvatar(jar);
    expect(await purged()).toEqual([]);

    const second = await setAvatar(jar);
    expect(await purged()).toEqual(absolute(first));

    const removed = await api.inject({
      method: 'DELETE',
      url: '/api/user/avatar',
      headers: jar.headers()
    });
    expect(removed.statusCode).toBe(200);
    expect(await purged()).toEqual(absolute(second));
  });

  it('purges the preview a save replaces, then the deleted document’s', async () => {
    const jar = await signUp('Grace');
    const id = await createProject(jar);
    const first = await setPreview(jar, id);
    const second = await setPreview(jar, id);
    expect(await purged()).toEqual(absolute(first));

    const deleted = await api.inject({
      method: 'DELETE',
      url: `/api/projects/${id}`,
      headers: jar.headers()
    });
    expect(deleted.statusCode).toBe(204);
    expect(await purged()).toEqual(absolute(second));
  });

  /**
   * The cascade takes the documents' rows and leaves their previews to the
   * sweep, so those are purged when the sweep deletes them, not before.
   */
  it('purges a deleted account’s avatar at once and its previews with the sweep', async () => {
    const jar = await signUp('Hedy');
    const avatar = await setAvatar(jar);
    const preview = await setPreview(jar, await createProject(jar));
    expect(await purged()).toEqual([]);

    const deleted = await api.inject({
      method: 'DELETE',
      url: '/api/user',
      headers: jar.headers(),
      payload: { password: 'lovelace1' }
    });
    expect(deleted.statusCode).toBe(204);
    expect(await purged()).toEqual(absolute(avatar));

    await api.app.get(OrphanSweepService).sweep('preview');
    expect(await purged()).toEqual(absolute(preview));
  });
});
