import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { EXAMPLES_ACCOUNT_ID, type LanguageId } from '@logigator/core';
import {
  componentTexts,
  components,
  projectDependencies,
  projectTexts,
  projects
} from '../src/database/schema';
import { loadExampleSet, type ExampleSet } from '../src/documents/example-set';
import { SeedExamplesService } from '../src/documents/seed-examples.service';
import { CookieJar } from './cookie-jar';
import { startE2eApp, type E2eApp } from './harness';

/** The package's own examples, which the bundle carries beside itself. */
const EXAMPLES_FOLDER = join(import.meta.dirname, '..', 'examples');

describe('seeding the examples', () => {
  let api: E2eApp;
  let set: ExampleSet;

  const seed = (examples: ExampleSet = set, previews = false) =>
    api.app.get(SeedExamplesService).run(examples, { previews });

  const seededRows = () =>
    api.db
      .select()
      .from(projects)
      .where(
        inArray(
          projects.id,
          set.projects.map((example) => example.id)
        )
      );

  const seededTexts = () =>
    api.db
      .select()
      .from(projectTexts)
      .where(
        inArray(
          projectTexts.documentId,
          set.projects.map((example) => example.id)
        )
      )
      .orderBy(projectTexts.documentId, projectTexts.language);

  async function listed(
    lang = 'en'
  ): Promise<{ id: string; name: string; machineTranslation: boolean }[]> {
    const response = await api.inject({
      method: 'GET',
      url: `/api/community/users/${EXAMPLES_ACCOUNT_ID}/projects?size=100&lang=${lang}`
    });
    expect(response.statusCode).toBe(200);
    return response.json().entries;
  }

  beforeAll(async () => {
    api = await startE2eApp();
    set = await loadExampleSet(EXAMPLES_FOLDER);
    await seed();
  });

  afterAll(async () => {
    await api.close();
  });

  it('lists the checked-in projects publicly, in manifest order', async () => {
    expect((await listed()).map((row) => row.id)).toEqual(
      set.projects.map((example) => example.id)
    );
  });

  it('keeps the examples out of the community browse listings', async () => {
    const browse = async (kind: 'projects' | 'components') => {
      const response = await api.inject({
        method: 'GET',
        url: `/api/community/${kind}?size=100&orderBy=latest`
      });
      expect(response.statusCode).toBe(200);
      return response.json().entries.map((row: { id: string }) => row.id);
    };
    const components = await api.inject({
      method: 'GET',
      url: `/api/community/users/${EXAMPLES_ACCOUNT_ID}/components`
    });

    expect(await browse('projects')).toEqual([]);
    expect(await browse('components')).toEqual([]);
    // Public all the same: the account's own listings still carry them.
    expect(
      components.json().entries.map((row: { id: string }) => row.id)
    ).toEqual(set.components.map((example) => example.id));
  });

  it('resolves every embedded master to its seeded row', async () => {
    const embedding = set.projects.filter((example) =>
      JSON.stringify(example.document).includes(set.components[0].id)
    );
    expect(embedding.length).toBeGreaterThan(0);

    const edges = await api.db
      .select()
      .from(projectDependencies)
      .where(
        inArray(
          projectDependencies.dependentId,
          embedding.map((example) => example.id)
        )
      );
    expect(edges.map((edge) => edge.dependencyId)).toEqual(
      embedding.map(() => set.components[0].id)
    );
  });

  it('writes every other language as a human version, and nothing is pending', async () => {
    for (const [table, texts, examples] of [
      [projects, projectTexts, set.projects],
      [components, componentTexts, set.components]
    ] as const) {
      for (const example of examples) {
        const [row] = await api.db
          .select()
          .from(table)
          .where(eq(table.id, example.id));
        expect(row.nameLanguage).toBe(example.language);
        expect(row.descriptionLanguage).toBe(example.language);
        expect(row.translatedDigest).toBe(row.textDigest);

        const versions = await api.db
          .select({
            language: texts.language,
            origin: texts.origin,
            name: texts.name,
            description: texts.description,
            sourceDigest: texts.sourceDigest
          })
          .from(texts)
          .where(eq(texts.documentId, example.id));
        expect(
          Object.fromEntries(
            versions.map((version) => [
              version.language,
              { name: version.name, description: version.description }
            ])
          )
        ).toEqual(example.texts);
        for (const version of versions) {
          expect(version.origin).toBe('human');
          expect(version.sourceDigest).toBe(row.textDigest);
        }
      }
    }
  });

  it('lists each example in the reader’s language, with no machine translation offered', async () => {
    const german = await listed('de');

    expect(german.map((row) => row.name)).toEqual(
      set.projects.map((example) => example.texts.de?.name ?? example.name)
    );
    expect(german.every((row) => !row.machineTranslation)).toBe(true);
  });

  it('writes nothing on a second run', async () => {
    const before = await seededRows();
    const textsBefore = await seededTexts();

    const report = await seed();

    expect(report.every((row) => row.document === 'unchanged')).toBe(true);
    expect(report.every((row) => row.preview === 'kept')).toBe(true);
    expect(await seededRows()).toEqual(before);
    expect(await seededTexts()).toEqual(textsBefore);
  });

  it('bumps an edited example and keeps the listing in manifest order', async () => {
    const [, edited] = set.projects;
    const [before] = await api.db
      .select()
      .from(projects)
      .where(eq(projects.id, edited.id));

    const report = await seed({
      ...set,
      projects: set.projects.map((example) =>
        example === edited
          ? { ...example, description: `${example.description} Edited.` }
          : example
      )
    });

    const [after] = await api.db
      .select()
      .from(projects)
      .where(eq(projects.id, edited.id));
    expect(after.version).toBe(before.version + 1);
    // The edit moves the digest, and the seed's languages and human versions
    // move with it, so the example is still not pending.
    expect(after.textDigest).not.toBe(before.textDigest);
    expect(after.translatedDigest).toBe(after.textDigest);
    const versions = await api.db
      .select({ sourceDigest: projectTexts.sourceDigest })
      .from(projectTexts)
      .where(eq(projectTexts.documentId, edited.id));
    expect(versions.length).toBeGreaterThan(0);
    expect(
      versions.every((version) => version.sourceDigest === after.textDigest)
    ).toBe(true);
    // The edit is a new preview too: both are written from the same files.
    expect(after.previewId).not.toBe(before.previewId);
    expect(
      report.filter((row) => row.document !== 'unchanged').map((r) => r.slug)
    ).toEqual([edited.slug]);
    expect((await listed()).map((row) => row.id)).toEqual(
      set.projects.map((example) => example.id)
    );
  });

  it('removes a human version the manifest no longer has, as no edit', async () => {
    // Back to the manifest as checked in, which the test before edited.
    await seed();
    const [first] = set.projects;
    const dropped = Object.keys(first.texts)[0] as LanguageId;
    const kept = { ...first.texts };
    delete kept[dropped];
    const [before] = await api.db
      .select()
      .from(projects)
      .where(eq(projects.id, first.id));

    const report = await seed({
      ...set,
      projects: set.projects.map((example) =>
        example === first ? { ...example, texts: kept } : example
      )
    });

    const remaining = await api.db
      .select({ language: projectTexts.language })
      .from(projectTexts)
      .where(
        and(
          eq(projectTexts.documentId, first.id),
          eq(projectTexts.origin, 'human')
        )
      );
    expect(remaining.map((row) => row.language).sort()).toEqual(
      Object.keys(kept).sort()
    );
    const [after] = await api.db
      .select()
      .from(projects)
      .where(eq(projects.id, first.id));
    expect(after.version).toBe(before.version);
    expect(after.previewId).toBe(before.previewId);
    expect(
      report.filter((row) => row.document !== 'unchanged').map((r) => r.slug)
    ).toEqual([first.slug]);

    // And the full manifest puts it back.
    await seed();
  });

  it('refuses a fixed id another account already holds', async () => {
    const jar = await signIn('grace@example.com');
    const response = await api.inject({
      method: 'POST',
      url: '/api/projects',
      headers: jar.headers(),
      payload: { name: 'Mine' }
    });
    const mine: string = response.json().id;
    const [, ...rest] = set.projects;

    await expect(
      seed({ ...set, projects: [{ ...set.projects[0], id: mine }, ...rest] })
    ).rejects.toThrow(/belongs to another account/);

    const [row] = await api.db
      .select()
      .from(projects)
      .where(eq(projects.id, mine));
    expect(row.name).toBe('Mine');
  });

  async function signIn(email: string): Promise<CookieJar> {
    const credentials = { email, password: 'lovelace1' };
    await api.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'Grace', ...credentials }
    });
    await api.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      payload: { token: api.mail.lastToken() }
    });

    const cookies = new CookieJar();
    cookies.store(
      await api.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: credentials
      })
    );
    return cookies;
  }
});
