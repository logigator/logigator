import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { CURRENT_FILE_VERSION } from '@logigator/core';
import type { ComponentSummary, ProjectSummary } from '@logigator/contract';
import {
  componentDependencies,
  components,
  projectDependencies,
  projects
} from '../src/database/schema';
import { RenormalizeService } from '../src/documents/renormalize.service';
import { circuitDocument, HALF_ADDER_BODY } from './circuits';
import { CookieJar } from './cookie-jar';
import { startE2eApp, type E2eApp } from './harness';

describe('re-normalizing stored documents', () => {
  let api: E2eApp;
  let jar: CookieJar;

  async function create<T>(
    kind: 'projects' | 'components',
    payload: Record<string, unknown>
  ): Promise<T> {
    const response = await api.inject({
      method: 'POST',
      url: `/api/${kind}`,
      headers: jar.headers(),
      payload
    });
    expect(response.statusCode).toBe(201);
    return response.json();
  }

  const renormalize = (all: boolean) =>
    api.app.get(RenormalizeService).run(all);

  beforeAll(async () => {
    api = await startE2eApp();
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

  describe('the re-extract pass', () => {
    it('rebuilds counts, ports and edges from the documents they came from', async () => {
      const component = await create<ComponentSummary>('components', {
        name: 'Ported',
        symbol: 'PRT',
        document: circuitDocument('Ported', HALF_ADDER_BODY)
      });

      // Corrupt every derived column and drop the edges, the way a bug or a
      // half-finished job would — this is what makes them a cache rather than a
      // second source of truth.
      await api.db
        .update(components)
        .set({
          componentCount: 999,
          wireCount: 999,
          numInputs: 0,
          numOutputs: 0,
          labels: []
        })
        .where(eq(components.id, component.id));
      await api.db
        .delete(componentDependencies)
        .where(eq(componentDependencies.dependentId, component.id));

      const report = await renormalize(true);
      expect(report.components.failed).toBe(0);

      const [row] = await api.db
        .select()
        .from(components)
        .where(eq(components.id, component.id));
      expect(row).toMatchObject({
        componentCount: 4,
        wireCount: 2,
        numInputs: 2,
        numOutputs: 1,
        labels: ['A', 'B', 'S']
      });
    });

    it('does not bump the version', async () => {
      const project = await create<ProjectSummary>('projects', {
        name: 'Unbumped',
        document: circuitDocument('Unbumped', HALF_ADDER_BODY)
      });

      await renormalize(true);

      const [row] = await api.db
        .select()
        .from(projects)
        .where(eq(projects.id, project.id));
      // Rewriting an encoding is not a user edit. Bumping here would offer every
      // placed instance of every component an update that changes nothing.
      expect(row.version).toBe(project.version);
      expect(row.lastEditedAt.toISOString()).toBe(project.lastEditedAt);
    });

    it('is idempotent, so a crashed run is resumed by running it again', async () => {
      await create<ProjectSummary>('projects', {
        name: 'Twice',
        document: circuitDocument('Twice', HALF_ADDER_BODY)
      });

      const first = await renormalize(true);
      const [before] = await api.db
        .select()
        .from(projects)
        .orderBy(projects.id)
        .limit(1);

      const second = await renormalize(true);
      const [after] = await api.db
        .select()
        .from(projects)
        .orderBy(projects.id)
        .limit(1);

      expect(second.projects.scanned).toBe(first.projects.scanned);
      expect(after).toEqual(before);
    });
  });

  describe('the format-bump pass', () => {
    it('leaves current rows alone, so there is nothing to do', async () => {
      await create<ProjectSummary>('projects', { name: 'Already current' });

      const report = await renormalize(false);
      // Writes are normalized, so the table only ever holds one version; this
      // pass exists for the rows an *older deploy* wrote.
      expect(report.projects.scanned).toBe(0);
      expect(report.components.scanned).toBe(0);
    });

    it('migrates a row an older deploy wrote, and re-extracts it', async () => {
      const project = await create<ProjectSummary>('projects', {
        name: 'Legacy row'
      });

      // Exactly what a pre-bump deploy leaves behind: a document at the older
      // version, with the column beside it saying so.
      const legacy = {
        project: {
          name: 'Legacy row',
          elements: [
            { t: 201, p: [15, 10], o: 1 },
            { t: 202, p: [28, 10], i: 1 },
            { t: 0, p: [16, 10], q: [28, 10] }
          ]
        }
      };
      await api.db
        .update(projects)
        .set({
          document: sql`${JSON.stringify(legacy)}::jsonb`,
          formatVersion: 0,
          componentCount: 0,
          wireCount: 0
        })
        .where(eq(projects.id, project.id));

      const report = await renormalize(false);
      expect(report.projects).toMatchObject({
        scanned: 1,
        rewritten: 1,
        failed: 0
      });

      const [row] = await api.db
        .select()
        .from(projects)
        .where(eq(projects.id, project.id));
      expect(row.formatVersion).toBe(CURRENT_FILE_VERSION);
      expect(row.document.version).toBe(CURRENT_FILE_VERSION);
      // Migrating changes what the derived metadata should say, which is why the
      // two passes are one job.
      expect(row).toMatchObject({ componentCount: 2, wireCount: 1 });

      // And the row is now current, so a second pass has nothing to do.
      expect((await renormalize(false)).projects.scanned).toBe(0);
    });

    it('reports a row it cannot parse, leaves it alone, and keeps going', async () => {
      const broken = await create<ProjectSummary>('projects', {
        name: 'Unparseable'
      });
      const fine = await create<ProjectSummary>('projects', {
        name: 'Parseable',
        document: circuitDocument('Parseable', HALF_ADDER_BODY)
      });

      const unparseable = { ...circuitDocument('Unparseable'), wires: 'junk' };
      for (const id of [broken.id, fine.id]) {
        await api.db
          .update(projects)
          .set({ formatVersion: 0 })
          .where(eq(projects.id, id));
      }
      await api.db
        .update(projects)
        .set({ document: sql`${JSON.stringify(unparseable)}::jsonb` })
        .where(eq(projects.id, broken.id));

      const report = await renormalize(false);

      // A job that stopped on the first bad row would leave the table half
      // converted, which is the state this whole design exists to avoid.
      expect(report.projects.failed).toBe(1);
      expect(report.projects.rewritten).toBeGreaterThanOrEqual(1);

      const [untouched] = await api.db
        .select()
        .from(projects)
        .where(eq(projects.id, broken.id));
      expect(untouched.document.wires).toBe('junk');
      expect(untouched.formatVersion).toBe(0);

      const [rewritten] = await api.db
        .select()
        .from(projects)
        .where(eq(projects.id, fine.id));
      expect(rewritten.formatVersion).toBe(CURRENT_FILE_VERSION);
    });
  });

  it('walks past a batch boundary without skipping or repeating a row', async () => {
    // Keyset pagination is what makes that true while rows are being written;
    // an offset walk over a shifting set does both.
    const fresh = await startE2eApp();
    try {
      const cookies = new CookieJar();
      await fresh.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          username: 'Bulk',
          email: 'bulk@example.com',
          password: 'lovelace1'
        }
      });
      await fresh.inject({
        method: 'POST',
        url: '/api/auth/verify-email',
        payload: { token: fresh.mail.lastToken() }
      });
      cookies.store(
        await fresh.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { email: 'bulk@example.com', password: 'lovelace1' }
        })
      );

      const total = 105;
      for (let index = 0; index < total; index += 1) {
        await fresh.inject({
          method: 'POST',
          url: '/api/projects',
          headers: cookies.headers(),
          payload: { name: `Row ${index}` }
        });
      }

      const report = await fresh.app.get(RenormalizeService).run(true);
      expect(report.projects).toMatchObject({
        scanned: total,
        rewritten: total,
        failed: 0
      });
    } finally {
      await fresh.close();
    }
  });

  it('leaves the edges of a document whose dependencies are gone empty', async () => {
    const orphaned = await create<ProjectSummary>('projects', {
      name: 'No deps',
      document: circuitDocument('No deps', HALF_ADDER_BODY)
    });

    await renormalize(true);

    const edges = await api.db
      .select()
      .from(projectDependencies)
      .where(eq(projectDependencies.dependentId, orphaned.id));
    expect(edges).toEqual([]);
  });
});
