import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import type {
  CommunityProject,
  ComponentSummary,
  DocumentTextsResponse,
  ProjectResponse,
  ProjectSummary
} from '@logigator/contract';
import { CUSTOM_TYPE_ID_BASE } from '@logigator/core';
import {
  componentTexts,
  components,
  projectTexts,
  projects
} from '../src/database/schema';
import {
  circuitDocument,
  gate,
  HALF_ADDER_BODY,
  serverSnapshot
} from './circuits';
import { CookieJar } from './cookie-jar';
import { startE2eApp, type E2eApp } from './harness';

/**
 * There is no text analysis worker in the harness, so what it would write —
 * the detected languages, the digest they are for, and the machine rows — is
 * written straight to the database. Everything else goes through the API.
 */
describe('document texts in other languages', () => {
  let api: E2eApp;
  let ada: CookieJar;
  let adaId: string;
  let grace: CookieJar;
  let graceId: string;

  /** A registered, signed-in member. At most thirty per spec file. */
  async function signUp(email: string, username: string): Promise<CookieJar> {
    const password = 'lovelace1';
    const registered = await api.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username, email, password }
    });
    expect(registered.statusCode).toBe(201);
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
        payload: { email, password }
      })
    );
    return cookies;
  }

  async function userId(cookies: CookieJar): Promise<string> {
    return (
      await api.inject({
        method: 'GET',
        url: '/api/user',
        headers: cookies.headers()
      })
    ).json().id;
  }

  async function createProject(
    payload: Record<string, unknown>,
    cookies = ada
  ): Promise<ProjectSummary> {
    const name = (payload['name'] as string | undefined) ?? 'Full Adder';
    const response = await api.inject({
      method: 'POST',
      url: '/api/projects',
      headers: cookies.headers(),
      payload: {
        name,
        description: 'Adds three bits.',
        visibility: 'public',
        document: circuitDocument(name, HALF_ADDER_BODY),
        ...payload
      }
    });
    expect(response.statusCode).toBe(201);
    return response.json();
  }

  /** What the worker writes once it has detected an English original. */
  async function markDetected(
    table: typeof projects | typeof components,
    id: string
  ): Promise<void> {
    await api.db
      .update(table)
      .set({
        nameLanguage: 'en',
        descriptionLanguage: 'en',
        analyzedDigest: sql`${table.textDigest}`
      })
      .where(eq(table.id, id));
  }

  /** A machine row written for the document's current text. */
  async function insertMachine(
    table: typeof projects | typeof components,
    id: string,
    language: string,
    text: { name: string | null; description: string | null }
  ): Promise<void> {
    const [row] = await api.db
      .select({ textDigest: table.textDigest })
      .from(table)
      .where(eq(table.id, id));
    await api.db
      .insert(table === projects ? projectTexts : componentTexts)
      .values({
        documentId: id,
        language,
        origin: 'machine',
        sourceDigest: row.textDigest,
        model: 'test/model',
        ...text
      });
  }

  /** A public project detected as English with a German machine translation. */
  async function translatedProject(
    payload: Record<string, unknown> = {}
  ): Promise<ProjectSummary> {
    const project = await createProject(payload);
    await markDetected(projects, project.id);
    await insertMachine(projects, project.id, 'de', {
      name: 'Volladdierer',
      description: 'Addiert drei Bits.'
    });
    return project;
  }

  async function communityEntry(
    url: string,
    id: string,
    cookies?: CookieJar
  ): Promise<CommunityProject | undefined> {
    const response = await api.inject({
      method: 'GET',
      url,
      headers: cookies?.headers()
    });
    expect(response.statusCode).toBe(200);
    // The machine text is never in a listing, not even in a field nobody reads.
    expect(response.body).not.toContain('Addiert drei Bits.');
    return response
      .json()
      .entries.find((entry: CommunityProject) => entry.id === id);
  }

  function detail(link: string, lang: string, cookies?: CookieJar) {
    return api.inject({
      method: 'GET',
      url: `/api/community/projects/${link}?lang=${lang}`,
      headers: cookies?.headers()
    });
  }

  function translation(link: string, lang: string, cookies?: CookieJar) {
    return api.inject({
      method: 'GET',
      url: `/api/community/projects/${link}/translation/${lang}`,
      headers: cookies?.headers()
    });
  }

  function putText(
    id: string,
    lang: string,
    payload: Record<string, unknown>,
    cookies = ada
  ) {
    return api.inject({
      method: 'PUT',
      url: `/api/projects/${id}/texts/${lang}`,
      headers: cookies.headers(),
      payload
    });
  }

  function deleteText(id: string, lang: string, cookies = ada) {
    return api.inject({
      method: 'DELETE',
      url: `/api/projects/${id}/texts/${lang}`,
      headers: cookies.headers()
    });
  }

  beforeAll(async () => {
    api = await startE2eApp();
    ada = await signUp('ada@example.com', 'Ada');
    grace = await signUp('grace@example.com', 'Grace');
    adaId = await userId(ada);
    graceId = await userId(grace);
  });

  afterAll(async () => {
    await api.close();
  });

  describe('machine translations', () => {
    it('are flagged on every community read and fetched from the endpoint alone', async () => {
      const project = await translatedProject();
      const star = await api.inject({
        method: 'PUT',
        url: `/api/community/projects/${project.link}/star`,
        headers: grace.headers()
      });
      expect(star.statusCode).toBe(200);

      const reads = [
        `/api/community/projects?lang=de&orderBy=latest`,
        `/api/community/users/${adaId}/projects?lang=de`,
        `/api/community/users/${graceId}/starred/projects?lang=de`
      ];
      for (const url of reads) {
        expect(await communityEntry(url, project.id)).toMatchObject({
          name: 'Full Adder',
          description: 'Adds three bits.',
          textLanguage: { name: 'en', description: 'en' },
          machineTranslation: true
        });
      }
      expect(
        await communityEntry(
          '/api/community/starred/projects?lang=de',
          project.id,
          grace
        )
      ).toMatchObject({ machineTranslation: true });

      const page = await detail(project.link, 'de');
      expect(page.json()).toMatchObject({
        name: 'Full Adder',
        machineTranslation: true
      });
      expect(page.body).not.toContain('Volladdierer');

      const translated = await translation(project.link, 'de');
      expect(translated.statusCode).toBe(200);
      expect(translated.headers['x-robots-tag']).toBe('noindex');
      expect(translated.headers['cache-control']).toBe('no-store');
      expect(translated.json()).toEqual({
        language: 'de',
        name: 'Volladdierer',
        description: 'Addiert drei Bits.',
        sourceLanguage: { name: 'en', description: 'en' }
      });
    });

    it('are neither flagged nor served for the original’s own language', async () => {
      const project = await translatedProject();

      expect((await detail(project.link, 'en')).json()).toMatchObject({
        machineTranslation: false
      });
      // Reads without a language are English reads.
      expect(
        (
          await api.inject({
            method: 'GET',
            url: `/api/community/projects/${project.link}`
          })
        ).json().machineTranslation
      ).toBe(false);
      expect((await translation(project.link, 'en')).statusCode).toBe(404);
      // A language with no machine row offers nothing either.
      expect((await translation(project.link, 'fr')).statusCode).toBe(404);
    });

    it('are withdrawn by an edit of the original', async () => {
      const project = await translatedProject();

      const edited = await api.inject({
        method: 'PATCH',
        url: `/api/projects/${project.id}`,
        headers: ada.headers(),
        payload: { description: 'Adds three bits, with carry.' }
      });
      expect(edited.statusCode).toBe(200);

      expect((await detail(project.link, 'de')).json()).toMatchObject({
        description: 'Adds three bits, with carry.',
        // The detection was of the older text, so it is not served either.
        textLanguage: { name: null, description: null },
        machineTranslation: false
      });
      expect((await translation(project.link, 'de')).statusCode).toBe(404);
    });

    it('resolve only where the document’s link does', async () => {
      const unlisted = await translatedProject({ visibility: 'unlisted' });
      const hidden = await translatedProject({ visibility: 'private' });

      expect((await translation(unlisted.link, 'de')).statusCode).toBe(200);
      expect((await translation(hidden.link, 'de')).statusCode).toBe(404);
      expect((await translation(hidden.link, 'de', grace)).statusCode).toBe(
        404
      );
      // Its owner previews the page the share dialog promises them.
      expect((await translation(hidden.link, 'de', ada)).statusCode).toBe(200);
    });
  });

  describe('human versions', () => {
    it('are shown instead of the original and suppress the flag per field', async () => {
      const project = await translatedProject();

      const named = await putText(project.id, 'de', { name: 'Addierer' });
      expect(named.statusCode).toBe(200);
      // A version sends the document to be judged again; the worker's call
      // detects the same original.
      await markDetected(projects, project.id);

      expect((await detail(project.link, 'de')).json()).toMatchObject({
        name: 'Addierer',
        description: 'Adds three bits.',
        textLanguage: { name: 'de', description: 'en' },
        // Still offered: the description has no human version.
        machineTranslation: true
      });
      expect((await translation(project.link, 'de')).json()).toEqual({
        language: 'de',
        name: null,
        description: 'Addiert drei Bits.',
        sourceLanguage: { name: null, description: 'en' }
      });

      // A PUT replaces the version whole.
      await putText(project.id, 'de', {
        name: 'Addierer',
        description: 'Addiert drei Bits, von Hand.'
      });
      await markDetected(projects, project.id);
      expect(
        await communityEntry(
          `/api/community/users/${adaId}/projects?lang=de`,
          project.id
        )
      ).toMatchObject({
        name: 'Addierer',
        description: 'Addiert drei Bits, von Hand.',
        textLanguage: { name: 'de', description: 'de' },
        machineTranslation: false
      });
      expect((await translation(project.link, 'de')).statusCode).toBe(404);
      // Readers of another language still get the original.
      expect((await detail(project.link, 'en')).json().name).toBe('Full Adder');

      // Removing it falls back to the machine row that was there all along.
      const removed = await deleteText(project.id, 'de');
      expect(removed.statusCode).toBe(200);
      expect(removed.json<DocumentTextsResponse>().texts).toEqual([]);
      await markDetected(projects, project.id);
      expect((await detail(project.link, 'de')).json()).toMatchObject({
        name: 'Full Adder',
        machineTranslation: true
      });
    });

    it('are found by search in any language, and machine text is not', async () => {
      const project = await translatedProject({ name: 'Ripple Adder' });
      await putText(project.id, 'fr', { name: 'Additionneur' });

      const search = (term: string) =>
        communityEntry(
          `/api/community/projects?lang=en&orderBy=latest&search=${term}`,
          project.id
        );

      expect(await search('additionneur')).toMatchObject({
        name: 'Ripple Adder'
      });
      expect(await search('Volladdierer')).toBeUndefined();

      // The owner's own search matches the same names.
      const own = await api.inject({
        method: 'GET',
        url: '/api/projects?search=Additionneur',
        headers: ada.headers()
      });
      expect(
        own.json().entries.map((entry: ProjectSummary) => entry.id)
      ).toEqual([project.id]);
    });

    it('are written by the owner alone, and touch neither version nor edit time', async () => {
      const project = await createProject({ name: 'Counter' });

      expect(
        (await putText(project.id, 'de', { name: 'Zähler' }, grace)).statusCode
      ).toBe(404);
      expect((await deleteText(project.id, 'de', grace)).statusCode).toBe(404);
      expect(
        (await putText(project.id, 'it', { name: 'Contatore' })).statusCode
      ).toBe(404);
      expect((await putText(project.id, 'de', {})).statusCode).toBe(422);
      // Blank is not a version: readers would be shown it for the original.
      expect(
        (await putText(project.id, 'de', { description: '  ' })).statusCode
      ).toBe(422);
      expect(
        await api.db
          .select()
          .from(projectTexts)
          .where(eq(projectTexts.documentId, project.id))
      ).toEqual([]);

      const written = await putText(project.id, 'de', { name: 'Zähler' });
      expect(written.statusCode).toBe(200);
      expect(written.json<DocumentTextsResponse>().texts).toEqual([
        { language: 'de', name: 'Zähler', description: null, stale: false }
      ]);

      const opened = await api.inject({
        method: 'GET',
        url: `/api/projects/${project.id}`,
        headers: ada.headers()
      });
      const response = opened.json<ProjectResponse>();
      expect(response.version).toBe(project.version);
      expect(response.lastEditedAt).toBe(project.lastEditedAt);
      expect(response.texts).toEqual(written.json().texts);
    });

    it('turn stale when the original is edited, and stay shown', async () => {
      const project = await createProject({ name: 'Shifter' });
      await putText(project.id, 'de', { name: 'Schieber' });
      await markDetected(projects, project.id);

      const before = await api.inject({
        method: 'GET',
        url: `/api/projects/${project.id}`,
        headers: ada.headers()
      });
      expect(before.json()).toMatchObject({
        nameLanguage: 'en',
        descriptionLanguage: 'en',
        texts: [{ language: 'de', stale: false }]
      });

      await api.inject({
        method: 'PATCH',
        url: `/api/projects/${project.id}`,
        headers: ada.headers(),
        payload: { name: 'Barrel Shifter' }
      });

      const listed = await api.inject({
        method: 'GET',
        url: '/api/projects?search=Barrel',
        headers: ada.headers()
      });
      expect(listed.json().entries).toMatchObject([
        {
          id: project.id,
          nameLanguage: null,
          descriptionLanguage: null,
          texts: [{ language: 'de', name: 'Schieber', stale: true }]
        }
      ]);
      expect((await detail(project.link, 'de')).json().name).toBe('Schieber');
    });
  });

  describe('a clone', () => {
    async function clone(kind: 'project' | 'component', link: string) {
      const response = await api.inject({
        method: 'POST',
        url: `/api/share/${kind}/${link}/clone`,
        headers: grace.headers()
      });
      expect(response.statusCode).toBe(201);
      return response.json();
    }

    /** A document's texts, without the columns that name the row itself. */
    const textRows = (
      texts: typeof projectTexts | typeof componentTexts,
      id: string
    ) =>
      api.db
        .select({
          language: texts.language,
          origin: texts.origin,
          name: texts.name,
          description: texts.description,
          sourceDigest: texts.sourceDigest,
          model: texts.model
        })
        .from(texts)
        .where(eq(texts.documentId, id))
        .orderBy(texts.language, texts.origin);

    async function bookkeeping(
      table: typeof projects | typeof components,
      id: string
    ) {
      const [row] = await api.db
        .select({
          textDigest: table.textDigest,
          analyzedDigest: table.analyzedDigest,
          nameLanguage: table.nameLanguage,
          descriptionLanguage: table.descriptionLanguage,
          textLanguageHint: table.textLanguageHint
        })
        .from(table)
        .where(eq(table.id, id));
      return row;
    }

    it('carries the texts and languages of the original and of every dependency', async () => {
      const inner = await api.inject({
        method: 'POST',
        url: '/api/components',
        headers: { ...ada.headers(), 'accept-language': 'de' },
        payload: {
          name: 'Inner',
          symbol: 'IN',
          visibility: 'public',
          document: circuitDocument('Inner', HALF_ADDER_BODY)
        }
      });
      const component = inner.json<ComponentSummary>();
      await markDetected(components, component.id);
      await insertMachine(components, component.id, 'fr', {
        name: 'Intérieur',
        description: null
      });

      const board = await translatedProject({
        name: 'Board',
        document: circuitDocument(
          'Board',
          { components: [gate(CUSTOM_TYPE_ID_BASE, 2, 2)], wires: [] },
          [
            serverSnapshot({
              type: CUSTOM_TYPE_ID_BASE,
              masterId: component.id,
              version: component.version,
              name: 'Inner'
            })
          ]
        )
      });
      await putText(board.id, 'es', { name: 'Tablero' });
      await markDetected(projects, board.id);

      const copy = await clone('project', board.link);
      const [copiedInner] = copy.dependencies as ComponentSummary[];

      expect(await textRows(projectTexts, copy.project.id)).toEqual(
        await textRows(projectTexts, board.id)
      );
      expect(await textRows(componentTexts, copiedInner.id)).toEqual(
        await textRows(componentTexts, component.id)
      );
      for (const [table, source, copied] of [
        [projects, board.id, copy.project.id],
        [components, component.id, copiedInner.id]
      ] as const) {
        const original = await bookkeeping(table, source);
        const cloned = await bookkeeping(table, copied);
        expect(cloned).toEqual(original);
        // Not pending: nothing would send the copy to a translator again.
        expect(cloned.analyzedDigest).toBe(cloned.textDigest);
      }

      // And it reads as the original does, under its new owner.
      const page = await detail(copy.project.link, 'de', grace);
      expect(page.json()).toMatchObject({ machineTranslation: true });
      expect(
        (await translation(copy.project.link, 'de', grace)).json()
      ).toMatchObject({
        name: 'Volladdierer'
      });
      const opened = await api.inject({
        method: 'GET',
        url: `/api/projects/${copy.project.id}`,
        headers: grace.headers()
      });
      expect(opened.json()).toMatchObject({
        nameLanguage: 'en',
        texts: [{ language: 'es', name: 'Tablero', stale: false }]
      });
    });
  });
});
