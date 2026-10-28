import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import sharp from 'sharp';
import {
  BuiltInComponentType,
  CURRENT_FILE_VERSION,
  type SerializedCircuitBody
} from '@logigator/core';
import type { ProjectSummary } from '@logigator/contract';
import { projects, users } from '../src/database/schema';
import { circuitDocument, gate, HALF_ADDER_BODY } from './circuits';
import { CookieJar } from './cookie-jar';
import { startE2eApp, type E2eApp } from './harness';
import { whileRowLocked } from './row-lock';

/** Forty gates: a document clearly bigger than the half adder. */
const WIDE_BODY: SerializedCircuitBody = {
  components: Array.from({ length: 40 }, (_, i) =>
    gate(BuiltInComponentType.AND, (i % 8) * 4, Math.floor(i / 8) * 4)
  ),
  wires: []
};

interface Account {
  jar: CookieJar;
  id: string;
}

describe('storage quota', () => {
  let api: E2eApp;
  let quota: number;
  let accounts = 0;

  async function signUp(): Promise<Account> {
    accounts += 1;
    const email = `member${accounts}@example.com`;
    const password = 'lovelace1';
    await api.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: `Member${accounts}`, email, password }
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
        payload: { email, password }
      })
    );
    const [user] = await api.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));
    return { jar, id: user.id };
  }

  function createProject(
    account: Account,
    name: string,
    body?: SerializedCircuitBody
  ) {
    return api.inject({
      method: 'POST',
      url: '/api/projects',
      headers: account.jar.headers(),
      payload: {
        name,
        ...(body ? { document: circuitDocument(name, body) } : {})
      }
    });
  }

  function saveProject(
    account: Account,
    project: ProjectSummary,
    body: SerializedCircuitBody
  ) {
    return api.inject({
      method: 'PUT',
      url: `/api/projects/${project.id}`,
      headers: account.jar.headers(),
      payload: {
        version: project.version,
        document: circuitDocument(project.name, body)
      }
    });
  }

  async function uploadPreview(account: Account, projectId: string) {
    const png = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 4,
        background: { r: 20, g: 180, b: 90, alpha: 1 }
      }
    })
      .png()
      .toBuffer();
    const form = new FormData();
    for (const slot of ['light', 'dark']) {
      form.set(
        slot,
        new Blob([new Uint8Array(png)], { type: 'image/png' }),
        `${slot}.png`
      );
    }
    const request = new Request('http://localhost', {
      method: 'POST',
      body: form
    });
    return api.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/preview`,
      headers: {
        ...account.jar.headers(),
        'content-type': request.headers.get('content-type') as string
      },
      payload: Buffer.from(await request.arrayBuffer())
    });
  }

  async function usageOf(account: Account): Promise<number> {
    const result = await api.db.execute<{ bytes: string }>(sql`
      SELECT (SELECT coalesce(sum(document_bytes + preview_bytes), 0)
                FROM projects WHERE user_id = ${account.id})
           + (SELECT coalesce(sum(document_bytes + preview_bytes), 0)
                FROM components WHERE user_id = ${account.id}) AS bytes
    `);
    return Number(result.rows[0].bytes);
  }

  /**
   * Leaves exactly `room` bytes free (negative: puts the account over) by
   * inflating the measured preview of a filler project. The quota reads the
   * columns, so this is the state a lowered limit or a legacy import leaves.
   */
  async function leaveRoom(account: Account, room: number): Promise<void> {
    const [filler] = await api.db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.userId, account.id), eq(projects.name, 'Filler')));
    const id = filler?.id ?? (await createProject(account, 'Filler')).json().id;

    const missing = quota - room - (await usageOf(account));
    await api.db
      .update(projects)
      .set({ previewBytes: sql`${projects.previewBytes} + ${missing}` })
      .where(eq(projects.id, id));
  }

  /** What the half adder costs as a document of its own, by that name. */
  async function halfAdderBytes(account: Account): Promise<number> {
    const created = (
      await createProject(account, 'Measured', HALF_ADDER_BODY)
    ).json();
    const [row] = await api.db
      .select({ bytes: projects.documentBytes })
      .from(projects)
      .where(eq(projects.id, created.id));
    await api.inject({
      method: 'DELETE',
      url: `/api/projects/${created.id}`,
      headers: account.jar.headers()
    });
    return row.bytes;
  }

  beforeAll(async () => {
    api = await startE2eApp();
    quota = api.env.STORAGE_QUOTA_BYTES;
  });

  afterAll(async () => {
    await api.close();
  });

  it('stores a document that lands on the quota, and refuses the next', async () => {
    const account = await signUp();
    await leaveRoom(account, await halfAdderBytes(account));

    const fits = await createProject(account, 'Measured', HALF_ADDER_BODY);
    expect(fits.statusCode).toBe(201);
    expect(await usageOf(account)).toBe(quota);

    const refused = await createProject(account, 'Empty');
    expect(refused.statusCode).toBe(403);
    expect(refused.json().code).toBe('storage_full');
    const names = await api.db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.userId, account.id));
    expect(names.map((row) => row.name).sort()).toEqual(['Filler', 'Measured']);
  });

  it('lets an account over its quota save smaller, and refuses saving bigger', async () => {
    const account = await signUp();
    const project: ProjectSummary = (
      await createProject(account, 'Board', HALF_ADDER_BODY)
    ).json();
    await leaveRoom(account, -1000);

    const bigger = await saveProject(account, project, WIDE_BODY);
    expect(bigger.statusCode).toBe(403);
    expect(bigger.json().code).toBe('storage_full');
    const [kept] = await api.db
      .select({ version: projects.version })
      .from(projects)
      .where(eq(projects.id, project.id));
    expect(kept.version).toBe(project.version);

    const smaller = await saveProject(account, project, {
      components: [],
      wires: []
    });
    expect(smaller.statusCode).toBe(200);
  });

  it('refuses a create that only fits before a concurrent write commits', async () => {
    const account = await signUp();
    await leaveRoom(account, await halfAdderBytes(account));

    // The held transaction is a second write of the same account: it takes
    // the lock the guard takes and adds a document. The racing create alone
    // would fit, and only waiting for the lock makes it see the other one.
    const response = await whileRowLocked(
      api.db,
      async (tx) => {
        await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, account.id))
          .for('no key update');
        await tx.insert(projects).values({
          userId: account.id,
          name: 'Concurrent',
          document: circuitDocument('Concurrent') as never,
          formatVersion: CURRENT_FILE_VERSION
        });
      },
      () => createProject(account, 'Measured', HALF_ADDER_BODY)
    );

    expect(response.statusCode).toBe(403);
    const names = await api.db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.userId, account.id));
    expect(names.map((row) => row.name).sort()).toEqual([
      'Concurrent',
      'Filler'
    ]);
  });

  it('counts a preview as the files it wrote, and refuses one with no room', async () => {
    const account = await signUp();
    const project: ProjectSummary = (
      await createProject(account, 'Previewed', HALF_ADDER_BODY)
    ).json();
    await leaveRoom(account, 0);
    const assetsBefore = await countPreviewAssets(api.env.STORAGE_DIR);

    const refused = await uploadPreview(account, project.id);
    expect(refused.statusCode).toBe(403);
    expect(refused.json().code).toBe('storage_full');
    expect(await countPreviewAssets(api.env.STORAGE_DIR)).toBe(assetsBefore);
    const [unchanged] = await api.db
      .select({ previewId: projects.previewId })
      .from(projects)
      .where(eq(projects.id, project.id));
    expect(unchanged.previewId).toBeNull();

    await leaveRoom(account, 1024 * 1024);
    expect((await uploadPreview(account, project.id)).statusCode).toBe(201);
    const [row] = await api.db
      .select({ previewId: projects.previewId, bytes: projects.previewBytes })
      .from(projects)
      .where(eq(projects.id, project.id));
    expect(row.bytes).toBe(
      await directoryBytes(api.env.STORAGE_DIR, row.previewId as string)
    );

    // The same renders again cost what the old ones did: not growth, so an
    // account over its quota can still refresh a preview.
    await leaveRoom(account, -1);
    expect((await uploadPreview(account, project.id)).statusCode).toBe(201);
  });

  it('refuses a clone that does not fit, leaving no copy and no copied preview', async () => {
    const owner = await signUp();
    const board: ProjectSummary = (
      await createProject(owner, 'Shared', HALF_ADDER_BODY)
    ).json();
    expect((await uploadPreview(owner, board.id)).statusCode).toBe(201);

    const cloner = await signUp();
    await leaveRoom(cloner, 10);
    const assetsBefore = await countPreviewAssets(api.env.STORAGE_DIR);

    const response = await api.inject({
      method: 'POST',
      url: `/api/share/project/${board.link}/clone`,
      headers: cloner.jar.headers()
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe('storage_full');
    expect(await countPreviewAssets(api.env.STORAGE_DIR)).toBe(assetsBefore);
    const copies = await api.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.forkedFromId, board.id));
    expect(copies).toEqual([]);
  });
});

async function countPreviewAssets(root: string): Promise<number> {
  let total = 0;
  for (const shard of await safeReaddir(join(root, 'preview'))) {
    total += (await safeReaddir(join(root, 'preview', shard))).length;
  }
  return total;
}

async function directoryBytes(root: string, id: string): Promise<number> {
  const directory = join(root, 'preview', id.slice(0, 2), id);
  let total = 0;
  for (const file of await readdir(directory)) {
    total += (await stat(join(directory, file))).size;
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
