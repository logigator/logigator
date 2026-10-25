import { readdir, stat, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { ProjectSummary } from '@logigator/contract';
import { projects } from '../src/database/schema';
import { FileStorageService } from '../src/storage/file-storage.service';
import { OrphanSweepService } from '../src/storage/orphan-sweep.service';
import { assetFilePath, assetIdOf } from './assets';
import { CookieJar } from './cookie-jar';
import { startE2eApp, type E2eApp } from './harness';

/** An 8×8 PNG — what a render arrives as, minus the size. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADklEQVQYlWNgGAWgEAAAAQgAAa5MwN8AAAAASUVORK5CYII=',
  'base64'
);

/** Bytes libvips can open and this API still refuses. */
const SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>'
);

/** A multipart body of file parts, encoded by Node's own `Request`. */
async function upload(
  parts: Record<string, Buffer>
): Promise<{ headers: Record<string, string>; payload: Buffer }> {
  const form = new FormData();
  for (const [name, content] of Object.entries(parts)) {
    form.set(
      name,
      new Blob([new Uint8Array(content)], { type: 'image/png' }),
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

describe('circuit previews', () => {
  let api: E2eApp;
  let jar: CookieJar;
  let storage: string;

  async function createProject(name: string): Promise<ProjectSummary> {
    const response = await api.inject({
      method: 'POST',
      url: '/api/projects',
      headers: jar.headers(),
      payload: { name }
    });
    expect(response.statusCode).toBe(201);
    return response.json();
  }

  async function setPreview(
    id: string,
    parts: Record<string, Buffer> = { light: PNG, dark: PNG }
  ) {
    const body = await upload(parts);
    return api.inject({
      method: 'POST',
      url: `/api/projects/${id}/preview`,
      headers: { ...jar.headers(), ...body.headers },
      payload: body.payload
    });
  }

  beforeAll(async () => {
    api = await startE2eApp({ STORAGE_SWEEP_GRACE_MINUTES: '0' });
    storage = api.env.STORAGE_DIR;

    const credentials = { email: 'ada@example.com', password: 'lovelace1' };
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

  describe('uploading', () => {
    it('answers both themes as their own variant ladder', async () => {
      const project = await createProject('Previewed');
      const response = await setPreview(project.id);

      expect(response.statusCode).toBe(201);
      const preview = response.json().preview;

      // Two lists: the client picks by the theme it draws in.
      for (const slot of ['light', 'dark'] as const) {
        expect(preview[slot]).toHaveLength(4);
        expect(
          preview[slot].map((v: { format: string }) => v.format).sort()
        ).toEqual(['png', 'png', 'webp', 'webp']);
        for (const variant of preview[slot]) {
          expect(variant.url).toMatch(
            new RegExp(
              `^/files/preview/[0-9a-f]{2}/[0-9a-f-]{36}/${slot}-\\d+\\.(webp|png)$`
            )
          );
        }
      }
    });

    it('writes every variant the response names', async () => {
      const project = await createProject('On disk');
      const response = await setPreview(project.id);
      const urls: string[] = [
        ...response.json().preview.light,
        ...response.json().preview.dark
      ].map((variant: { url: string }) => variant.url);

      for (const url of urls) {
        // The list comes from a table rather than the volume, so every URL it
        // names has to resolve.
        expect((await stat(assetFilePath(api, url))).size).toBeGreaterThan(0);
      }
    });

    it('replaces the asset and deletes the one it replaced', async () => {
      const project = await createProject('Replaced');
      const first = await setPreview(project.id);
      const firstUrl = first.json().preview.light[0].url;

      const second = await setPreview(project.id);
      const secondUrl = second.json().preview.light[0].url;

      // A fresh id per write is what keeps the URLs behind it cacheable forever.
      expect(secondUrl).not.toBe(firstUrl);
      await expect(stat(assetFilePath(api, firstUrl))).rejects.toThrow();
      await expect(stat(assetFilePath(api, secondUrl))).resolves.toBeDefined();
    });

    it('is not an edit, so it leaves the version and the edit time alone', async () => {
      const project = await createProject('Unedited');
      const response = await setPreview(project.id);

      expect(response.json()).toMatchObject({
        version: project.version,
        lastEditedAt: project.lastEditedAt
      });
    });

    it('needs both renders', async () => {
      const project = await createProject('Half a preview');

      const response = await setPreview(project.id, { light: PNG });
      expect(response.statusCode).toBe(400);
      // Replacing only one would leave the two showing different circuits.
      expect(response.json().message).toMatch('dark');
    });

    it('refuses a part it did not ask for', async () => {
      const project = await createProject('Extra part');

      const response = await setPreview(project.id, {
        light: PNG,
        sepia: PNG
      });
      expect(response.statusCode).toBe(400);
    });

    it('refuses what libvips would happily rasterize', async () => {
      const project = await createProject('Not an image');

      const response = await setPreview(project.id, { light: SVG, dark: PNG });
      // "Images only" means the formats served, not everything libvips opens.
      expect(response.statusCode).toBe(415);
    });

    it('writes nothing when a render cannot be decoded', async () => {
      const project = await createProject('Undecodable');
      const before = await countAssets(storage);

      const response = await setPreview(project.id, {
        light: Buffer.from('not an image at all'),
        dark: PNG
      });
      expect(response.statusCode).toBe(415);

      expect(await countAssets(storage)).toBe(before);
      const [row] = await api.db
        .select()
        .from(projects)
        .where(eq(projects.id, project.id));
      expect(row.previewId).toBeNull();
    });

    it('is refused for somebody else´s project', async () => {
      const project = await createProject('Not yours');
      const body = await upload({ light: PNG, dark: PNG });

      const response = await api.inject({
        method: 'POST',
        url: `/api/projects/${project.id}/preview`,
        headers: body.headers,
        payload: body.payload
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('removing', () => {
    it('clears the pointer and the files behind it', async () => {
      const project = await createProject('Cleared');
      const set = await setPreview(project.id);
      const url = set.json().preview.light[0].url;

      const cleared = await api.inject({
        method: 'DELETE',
        url: `/api/projects/${project.id}/preview`,
        headers: jar.headers()
      });

      expect(cleared.statusCode).toBe(200);
      expect(cleared.json().preview).toBeNull();
      await expect(stat(assetFilePath(api, url))).rejects.toThrow();
    });

    it('is harmless when there was none', async () => {
      const project = await createProject('Never had one');

      const response = await api.inject({
        method: 'DELETE',
        url: `/api/projects/${project.id}/preview`,
        headers: jar.headers()
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().preview).toBeNull();
    });
  });

  describe('the orphan sweep', () => {
    it('deletes what no row points at and keeps what one does', async () => {
      const kept = await createProject('Kept');
      const set = await setPreview(kept.id);
      const keptId = assetIdOf(set.json().preview.light[0].url);

      // An asset whose pointer never landed, as a crash between the write and
      // the update leaves behind.
      const orphanId = await writeOrphan(api);

      const report = await api.app.get(OrphanSweepService).sweep('preview');

      expect(report.removed).toBe(1);
      await expect(
        stat(join(storage, 'preview', orphanId.slice(0, 2), orphanId))
      ).rejects.toThrow();
      await expect(
        stat(join(storage, 'preview', keptId.slice(0, 2), keptId))
      ).resolves.toBeDefined();
    });

    it('spares an asset younger than the grace window', async () => {
      const fresh = await startE2eApp({
        STORAGE_SWEEP_GRACE_MINUTES: '1440'
      });
      try {
        // Not backdated: a directory written moments ago is the in-flight
        // upload the window protects.
        const orphanId = await fresh.app
          .get(FileStorageService)
          .writeAsset('preview', [
            { name: 'light-256.webp', content: Buffer.from('in flight') }
          ]);
        const report = await fresh.app.get(OrphanSweepService).sweep('preview');

        // An upload in flight is a directory no row names *yet*; only its age
        // tells it from an orphan.
        expect(report.removed).toBe(0);
        expect(report.spared).toBe(1);
        await expect(
          stat(
            join(
              fresh.env.STORAGE_DIR,
              'preview',
              orphanId.slice(0, 2),
              orphanId
            )
          )
        ).resolves.toBeDefined();
      } finally {
        await fresh.close();
      }
    });

    it('leaves alone anything not shaped like an asset', async () => {
      const report = await api.app.get(OrphanSweepService).sweep('preview');
      // The second run has nothing left to do.
      expect(report.removed).toBe(0);
    });
  });
});

/**
 * Writes an asset directory nothing points at, through the service the upload
 * path uses, so the sweep meets the layout it has to recognise.
 */
async function writeOrphan(app: E2eApp): Promise<string> {
  const id = await app.app
    .get(FileStorageService)
    .writeAsset('preview', [
      { name: 'light-256.webp', content: Buffer.from('stale') }
    ]);

  // Backdated so a grace window is what the spec is varying, not the clock.
  await utimes(
    join(app.env.STORAGE_DIR, 'preview', id.slice(0, 2), id),
    new Date(0),
    new Date(0)
  );
  return id;
}

async function countAssets(root: string): Promise<number> {
  let total = 0;
  for (const area of ['profile', 'preview']) {
    for (const shard of await safeReaddir(join(root, area))) {
      total += (await safeReaddir(join(root, area, shard))).length;
    }
  }
  return total;
}

async function safeReaddir(path: string): Promise<string[]> {
  try {
    return await readdir(path);
  } catch {
    return [];
  }
}
