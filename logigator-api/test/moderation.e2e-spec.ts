import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CUSTOM_TYPE_ID_BASE } from '@logigator/core';
import type {
  ComponentSummary,
  OwnedProjectSummary,
  ProjectSummary,
  WrittenProjectSummary
} from '@logigator/contract';
import { eq } from 'drizzle-orm';
import { documentReports, users } from '../src/database/schema';
import { ModerationService } from '../src/moderation/moderation.service';
import {
  circuitDocument,
  gate,
  HALF_ADDER_BODY,
  serverSnapshot
} from './circuits';
import { CookieJar } from './cookie-jar';
import { startE2eApp, type E2eApp } from './harness';

const MODEL = CUSTOM_TYPE_ID_BASE;

const REPORT = {
  reason: 'copyright',
  explanation: 'This is my circuit, copied without permission.'
} as const;

describe('moderation', () => {
  let api: E2eApp;
  let moderation: ModerationService;
  /** The author whose documents are reported and hidden. */
  let ada: CookieJar;
  let adaId: string;
  /** Everybody else. */
  let grace: CookieJar;

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

  async function create<T>(
    kind: 'projects' | 'components',
    payload: Record<string, unknown>,
    cookies: CookieJar
  ): Promise<T> {
    const response = await api.inject({
      method: 'POST',
      url: `/api/${kind}`,
      headers: cookies.headers(),
      payload
    });
    expect(response.statusCode).toBe(201);
    return response.json();
  }

  const publicProject = (name: string, cookies = ada) =>
    create<ProjectSummary>(
      'projects',
      {
        name,
        visibility: 'public',
        document: circuitDocument(name, HALF_ADDER_BODY)
      },
      cookies
    );

  const get = (url: string, cookies?: CookieJar) =>
    api.inject({ method: 'GET', url, headers: cookies?.headers() ?? {} });

  const report = (
    kind: 'projects' | 'components',
    link: string,
    payload: Record<string, unknown> = REPORT,
    cookies?: CookieJar
  ) =>
    api.inject({
      method: 'POST',
      url: `/api/community/${kind}/${link}/report`,
      headers: cookies?.headers() ?? {},
      payload
    });

  const listedIds = async (url: string, cookies?: CookieJar) =>
    ((await get(url, cookies)).json().entries as { id: string }[]).map(
      (entry) => entry.id
    );

  beforeAll(async () => {
    api = await startE2eApp({ REPORT_MAIL_TO: 'ops@logigator.test' });
    moderation = api.app.get(ModerationService);
    ada = await signUp('ada@example.com', 'Ada');
    grace = await signUp('grace@example.com', 'Grace');
    adaId = (await get('/api/user', ada)).json().id;
  });

  afterAll(async () => {
    await api.close();
  });

  describe('reports', () => {
    it('are taken from a visitor with no session, stored and mailed', async () => {
      const project = await publicProject('Reported');
      api.mail.clear();

      const response = await report('projects', project.link, {
        ...REPORT,
        contactEmail: 'Owner@Example.com'
      });

      expect(response.statusCode).toBe(201);
      const [row] = await api.db
        .select()
        .from(documentReports)
        .where(eq(documentReports.documentId, project.id));
      expect(row).toMatchObject({
        documentKind: 'project',
        source: 'reader',
        reason: 'copyright',
        explanation: REPORT.explanation,
        contactEmail: 'owner@example.com',
        reporterId: null,
        resolvedAt: null
      });

      expect(api.mail.sent).toHaveLength(1);
      const mail = api.mail.last();
      expect(mail.to).toBe('ops@logigator.test');
      expect(mail.replyTo).toBe('owner@example.com');
      expect(mail.text).toContain(project.link);
      expect(mail.text).toContain(REPORT.explanation);
    });

    it('record the reporter when there is a session', async () => {
      const project = await publicProject('Signed report');
      const graceId = (await get('/api/user', grace)).json().id;

      expect(
        (await report('projects', project.link, REPORT, grace)).statusCode
      ).toBe(201);

      const [row] = await api.db
        .select()
        .from(documentReports)
        .where(eq(documentReports.documentId, project.id));
      expect(row?.reporterId).toBe(graceId);
    });

    it('reach every document the link resolves for, and nothing else', async () => {
      const unlisted = await create<ComponentSummary>(
        'components',
        { name: 'Unlisted', symbol: 'U', visibility: 'unlisted' },
        ada
      );
      const secret = await create<ProjectSummary>(
        'projects',
        { name: 'Secret', visibility: 'private' },
        ada
      );

      expect((await report('components', unlisted.link)).statusCode).toBe(201);
      // A private link resolves for its owner alone, so to anybody else there
      // is nothing at that address to report.
      expect((await report('projects', secret.link)).statusCode).toBe(404);
      expect(
        (await report('projects', secret.link, REPORT, grace)).statusCode
      ).toBe(404);
    });

    it('need a reason and an explanation', async () => {
      const project = await publicProject('Vague');

      const response = await report('projects', project.link, {
        reason: 'spam',
        explanation: '   '
      });

      expect(response.statusCode).toBe(422);
      expect(Object.keys(response.json().details)).toEqual(['explanation']);
    });
  });

  describe('a hidden document', () => {
    let hidden: ProjectSummary;

    beforeAll(async () => {
      hidden = await publicProject('Hidden');
      await api.inject({
        method: 'PUT',
        url: `/api/community/projects/${hidden.link}/star`,
        headers: grace.headers()
      });
      await report('projects', hidden.link);

      const result = await moderation.hide(
        'project',
        hidden.link,
        'Copyright notice'
      );
      expect(result).toEqual({ resolvedReports: 1, ownerMailed: true });
    });

    it('drops out of every listing, search and profile', async () => {
      expect(await listedIds('/api/community/projects')).not.toContain(
        hidden.id
      );
      expect(
        await listedIds('/api/community/projects?search=Hidden')
      ).not.toContain(hidden.id);
      expect(
        await listedIds(`/api/community/users/${adaId}/projects`)
      ).not.toContain(hidden.id);
      expect(
        await listedIds('/api/community/starred/projects', grace)
      ).not.toContain(hidden.id);
    });

    it('stops counting on its author’s profile, stars included', async () => {
      const before = (await get(`/api/community/users/${adaId}`)).json();
      await moderation.unhide('project', hidden.link);
      const after = (await get(`/api/community/users/${adaId}`)).json();
      await moderation.hide('project', hidden.link, 'Copyright notice');

      expect(after.publicProjects).toBe(before.publicProjects + 1);
      expect(after.stars).toBe(before.stars + 1);
    });

    it('resolves for nobody but its owner', async () => {
      for (const cookies of [undefined, grace]) {
        expect(
          (await get(`/api/community/projects/${hidden.link}`, cookies))
            .statusCode
        ).toBe(404);
        expect(
          (await get(`/api/share/project/${hidden.link}`, cookies)).statusCode
        ).toBe(404);
        expect(
          (await get(`/api/share/project/${hidden.link}/card.png`, cookies))
            .statusCode
        ).toBe(404);
        expect(
          (
            await get(
              `/api/community/projects/${hidden.link}/translation/de`,
              cookies
            )
          ).statusCode
        ).toBe(404);
      }
      expect(
        (await get(`/api/community/projects/${hidden.link}/stargazers`))
          .statusCode
      ).toBe(404);
      expect(
        (
          await api.inject({
            method: 'POST',
            url: `/api/share/project/${hidden.link}/clone`,
            headers: grace.headers()
          })
        ).statusCode
      ).toBe(404);
      expect((await report('projects', hidden.link)).statusCode).toBe(404);
    });

    it('tells its owner, and only its owner, why', async () => {
      const own = await get(`/api/community/projects/${hidden.link}`, ada);
      expect(own.statusCode).toBe(200);
      expect(own.json().hidden).toMatchObject({ reason: 'Copyright notice' });

      const shelf = (await get('/api/projects', ada)).json()
        .entries as OwnedProjectSummary[];
      expect(shelf.find((entry) => entry.id === hidden.id)?.hidden).toEqual(
        own.json().hidden
      );

      // Somebody else's page carries no moderation field at all.
      const other = await publicProject('Visible');
      const visible = await get(`/api/community/projects/${other.link}`, grace);
      expect(visible.json()).not.toHaveProperty('hidden');
    });

    it('mails its owner on hide and on unhide', async () => {
      const other = await publicProject('Mailed');
      api.mail.clear();

      await moderation.hide('project', other.link, 'Copied from <a> book');
      const hiddenMail = api.mail.last();
      expect(hiddenMail.to).toBe('ada@example.com');
      expect(hiddenMail.text).toContain('Mailed');
      expect(hiddenMail.text).toContain('Copied from <a> book');
      expect(hiddenMail.html).toContain('Copied from &lt;a&gt; book');
      expect(hiddenMail.text).toContain(`/en/community/projects/${other.link}`);
      // Objecting is a reply, and it reaches the operator.
      expect(hiddenMail.replyTo).toBe('ops@logigator.test');

      expect(await moderation.unhide('project', other.link)).toEqual({
        ownerMailed: true
      });
      expect(api.mail.sent).toHaveLength(2);
      expect(api.mail.last()).toMatchObject({
        to: 'ada@example.com',
        subject: 'Your document is visible again'
      });
    });

    it('does not mail an owner whose address is unverified', async () => {
      const other = await publicProject('Unverified owner');
      await api.db
        .update(users)
        .set({ emailVerified: false })
        .where(eq(users.id, adaId));
      try {
        api.mail.clear();
        expect(
          await moderation.hide('project', other.link, 'Spam')
        ).toMatchObject({ ownerMailed: false });
        expect(api.mail.sent).toEqual([]);
      } finally {
        await api.db
          .update(users)
          .set({ emailVerified: true })
          .where(eq(users.id, adaId));
      }
    });

    it('stays hidden through its owner’s visibility changes', async () => {
      for (const visibility of ['unlisted', 'public'] as const) {
        const response = await api.inject({
          method: 'PATCH',
          url: `/api/projects/${hidden.id}`,
          headers: ada.headers(),
          payload: { visibility }
        });
        expect(response.statusCode).toBe(200);
        // The answer tells its owner as the shelf does.
        expect(response.json<WrittenProjectSummary>().hidden).toMatchObject({
          reason: 'Copyright notice',
          automatic: false
        });
      }

      expect(
        (await get(`/api/community/projects/${hidden.link}`)).statusCode
      ).toBe(404);
    });

    it('comes back as it was when unhidden, stars and all', async () => {
      const other = await publicProject('Unhidden');
      await api.inject({
        method: 'PUT',
        url: `/api/community/projects/${other.link}/star`,
        headers: grace.headers()
      });
      await moderation.hide('project', other.link, 'Mistake');
      await moderation.unhide('project', other.link);

      const page = await get(`/api/community/projects/${other.link}`);
      expect(page.statusCode).toBe(200);
      expect(page.json()).toMatchObject({ stars: 1, starred: false });
      expect(await listedIds('/api/community/projects')).toContain(other.id);
    });
  });

  describe('a hidden component', () => {
    it('keeps its dependents working without naming itself to them', async () => {
      const master = await create<ComponentSummary>(
        'components',
        {
          name: 'Master',
          symbol: 'M',
          visibility: 'public',
          document: circuitDocument('Master', HALF_ADDER_BODY)
        },
        ada
      );
      const board = await create<ProjectSummary>(
        'projects',
        {
          name: 'Board',
          visibility: 'public',
          document: circuitDocument(
            'Board',
            { components: [gate(MODEL, 2, 2)], wires: [] },
            [
              serverSnapshot({
                type: MODEL,
                masterId: master.id,
                version: master.version,
                name: 'Master'
              })
            ]
          )
        },
        grace
      );

      await moderation.hide('component', master.link, 'Harassment');

      // The dependent opens and shares as before: the snapshot is all it needs.
      const opened = await get(`/api/projects/${board.id}`, grace);
      expect(opened.statusCode).toBe(200);
      expect(opened.json().dependencies).toEqual([]);
      const shared = await get(`/api/share/project/${board.link}`);
      expect(shared.statusCode).toBe(200);
      expect(shared.json().dependencies).toEqual([]);

      // A copy of the dependent takes no copy of the hidden master.
      const clone = await api.inject({
        method: 'POST',
        url: `/api/share/project/${board.link}/clone`,
        headers: ada.headers()
      });
      expect(clone.statusCode).toBe(201);
      expect(
        (clone.json().dependencies as ComponentSummary[]).map((c) => c.name)
      ).toEqual(['Master']);

      // That clone was by the master's owner, who may copy it; anybody else
      // gets the dependent with its snapshot and no master.
      const adasBoard = await create<ProjectSummary>(
        'projects',
        {
          name: 'Board 2',
          visibility: 'public',
          document: circuitDocument(
            'Board 2',
            { components: [gate(MODEL, 2, 2)], wires: [] },
            [
              serverSnapshot({
                type: MODEL,
                masterId: master.id,
                version: master.version,
                name: 'Master'
              })
            ]
          )
        },
        ada
      );
      const graceClone = await api.inject({
        method: 'POST',
        url: `/api/share/project/${adasBoard.link}/clone`,
        headers: grace.headers()
      });
      expect(graceClone.statusCode).toBe(201);
      expect(graceClone.json().dependencies).toEqual([]);
    });
  });

  describe('resolving a report', () => {
    it('closes it once', async () => {
      const project = await publicProject('Resolved');
      await report('projects', project.link, {
        reason: 'spam',
        explanation: 'Advertising.'
      });
      const open = await moderation.openReports();
      const entry = open.find((r) => r.document?.id === project.id);
      expect(entry?.source).toBe('reader');
      expect(entry?.document).toMatchObject({
        link: project.link,
        ownerId: adaId,
        hidden: false
      });

      expect(await moderation.resolve(entry!.id, 'Not spam')).toBe('resolved');
      expect(await moderation.resolve(entry!.id, 'Again')).toBe('missing');
      expect(
        (await moderation.openReports()).some((r) => r.id === entry!.id)
      ).toBe(false);
    });
  });
});
