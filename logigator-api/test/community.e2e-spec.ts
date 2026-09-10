import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  Author,
  CommunityProject,
  ComponentSummary,
  ProjectSummary
} from '@logigator/contract';
import { circuitDocument, HALF_ADDER_BODY } from './circuits';
import { CookieJar } from './cookie-jar';
import { startE2eApp, type E2eApp } from './harness';

describe('the community surface', () => {
  let api: E2eApp;
  let ada: CookieJar;
  let adaId: string;
  let grace: CookieJar;

  async function signUp(email: string, username: string): Promise<CookieJar> {
    const password = 'lovelace1';
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
      { name, public: true, document: circuitDocument(name, HALF_ADDER_BODY) },
      cookies
    );

  beforeAll(async () => {
    api = await startE2eApp();
    ada = await signUp('ada@example.com', 'Ada');
    grace = await signUp('grace@example.com', 'Grace');

    adaId = (
      await api.inject({
        method: 'GET',
        url: '/api/user',
        headers: ada.headers()
      })
    ).json().id;
  });

  afterAll(async () => {
    await api.close();
  });

  describe('listings', () => {
    it('show published documents to anybody, with their author', async () => {
      const project = await publicProject('Published');

      const response = await api.inject({
        method: 'GET',
        url: '/api/community/projects'
      });

      expect(response.statusCode).toBe(200);
      const entry = response
        .json()
        .entries.find((e: CommunityProject) => e.id === project.id);
      expect(entry).toMatchObject({
        name: 'Published',
        author: { id: adaId, username: 'Ada' },
        stars: 0,
        // No session, so nothing is starred.
        starred: false
      });
    });

    it('never show an unpublished document', async () => {
      const hidden = await create<ProjectSummary>(
        'projects',
        { name: 'Unpublished' },
        ada
      );

      // Even to its owner: publishing is the access rule here.
      const response = await api.inject({
        method: 'GET',
        url: '/api/community/projects',
        headers: ada.headers()
      });
      expect(
        response.json().entries.map((e: CommunityProject) => e.id)
      ).not.toContain(hidden.id);
    });

    it('stop showing a document that is unpublished again', async () => {
      const project = await publicProject('Retracted');

      await api.inject({
        method: 'PATCH',
        url: `/api/projects/${project.id}`,
        headers: ada.headers(),
        payload: { public: false }
      });

      const response = await api.inject({
        method: 'GET',
        url: '/api/community/projects'
      });
      expect(
        response.json().entries.map((e: CommunityProject) => e.id)
      ).not.toContain(project.id);
    });

    it('rank by stars, and break the tie so paging is stable', async () => {
      // The starred one is created *first*, so the two orderings disagree;
      // otherwise the test would pass whichever ranking ran.
      const hot = await publicProject('Starred');
      const cold = await publicProject('Unstarred');

      await api.inject({
        method: 'PUT',
        url: `/api/community/projects/${hot.link}/star`,
        headers: grace.headers()
      });

      const byStars = await api.inject({
        method: 'GET',
        url: '/api/community/projects?size=100'
      });
      const ids = byStars.json().entries.map((e: CommunityProject) => e.id);
      expect(ids.indexOf(hot.id)).toBeLessThan(ids.indexOf(cold.id));

      // `latest` is the other axis: newest edit first, whatever the stars say.
      const byTime = await api.inject({
        method: 'GET',
        url: '/api/community/projects?orderBy=latest&size=100'
      });
      const latest = byTime.json().entries.map((e: CommunityProject) => e.id);
      expect(latest.indexOf(cold.id)).toBeLessThan(latest.indexOf(hot.id));
    });

    it('report whether the caller starred each row', async () => {
      const project = await publicProject('Mine to star');
      await api.inject({
        method: 'PUT',
        url: `/api/community/projects/${project.link}/star`,
        headers: grace.headers()
      });

      const asGrace = await api.inject({
        method: 'GET',
        url: '/api/community/projects?size=100',
        headers: grace.headers()
      });
      expect(
        asGrace
          .json()
          .entries.find((e: CommunityProject) => e.id === project.id).starred
      ).toBe(true);

      const asAda = await api.inject({
        method: 'GET',
        url: '/api/community/projects?size=100',
        headers: ada.headers()
      });
      expect(
        asAda.json().entries.find((e: CommunityProject) => e.id === project.id)
          .starred
      ).toBe(false);
    });

    it('page and count the whole match', async () => {
      const response = await api.inject({
        method: 'GET',
        url: '/api/community/projects?size=1'
      });
      expect(response.json()).toMatchObject({ page: 0, pageSize: 1 });
      expect(response.json().entries).toHaveLength(1);
      expect(response.json().total).toBeGreaterThan(1);
    });
  });

  describe('a document´s page', () => {
    it('is addressed by the share token, and dies with it', async () => {
      const project = await publicProject('Addressed');

      const found = await api.inject({
        method: 'GET',
        url: `/api/community/projects/${project.link}`
      });
      expect(found.statusCode).toBe(200);
      expect(found.json()).toMatchObject({ id: project.id, forkedFrom: null });

      await api.inject({
        method: 'PATCH',
        url: `/api/projects/${project.id}`,
        headers: ada.headers(),
        payload: { regenerateLink: true }
      });

      // Regenerating the token takes the public page with it.
      const gone = await api.inject({
        method: 'GET',
        url: `/api/community/projects/${project.link}`
      });
      expect(gone.statusCode).toBe(404);
    });

    it('refuses an unpublished document even by its token', async () => {
      const project = await create<ProjectSummary>(
        'projects',
        { name: 'Not published' },
        ada
      );

      const community = await api.inject({
        method: 'GET',
        url: `/api/community/projects/${project.link}`
      });
      expect(community.statusCode).toBe(404);

      // The same token still opens the share: a link is a capability,
      // publishing is a listing.
      const share = await api.inject({
        method: 'GET',
        url: `/api/share/${project.link}`
      });
      expect(share.statusCode).toBe(200);
    });

    it('credits the document it was forked from', async () => {
      const original = await publicProject('Ancestor');
      const clone = (
        await api.inject({
          method: 'POST',
          url: `/api/share/${original.link}/clone`,
          headers: grace.headers()
        })
      ).json();

      await api.inject({
        method: 'PATCH',
        url: `/api/projects/${clone.project.id}`,
        headers: grace.headers(),
        payload: { public: true }
      });

      const response = await api.inject({
        method: 'GET',
        url: `/api/community/projects/${clone.project.link}`
      });
      expect(response.json().forkedFrom).toMatchObject({
        id: original.id,
        name: 'Ancestor',
        link: original.link,
        authorName: 'Ada'
      });
    });
  });

  describe('stars', () => {
    it('state the state they want, so a retry is harmless', async () => {
      const project = await publicProject('Idempotent');
      const star = () =>
        api.inject({
          method: 'PUT',
          url: `/api/community/projects/${project.link}/star`,
          headers: grace.headers()
        });

      expect((await star()).json()).toEqual({ starred: true, stars: 1 });
      // A double-tapped button is not two stars.
      expect((await star()).json()).toEqual({ starred: true, stars: 1 });

      const unstar = () =>
        api.inject({
          method: 'DELETE',
          url: `/api/community/projects/${project.link}/star`,
          headers: grace.headers()
        });
      expect((await unstar()).json()).toEqual({ starred: false, stars: 0 });
      expect((await unstar()).json()).toEqual({ starred: false, stars: 0 });
    });

    it('need a session', async () => {
      const project = await publicProject('Needs auth');

      const response = await api.inject({
        method: 'PUT',
        url: `/api/community/projects/${project.link}/star`
      });
      expect(response.statusCode).toBe(401);
    });

    it('cannot be given to something unpublished', async () => {
      const project = await create<ProjectSummary>(
        'projects',
        { name: 'Private' },
        ada
      );

      const response = await api.inject({
        method: 'PUT',
        url: `/api/community/projects/${project.link}/star`,
        headers: grace.headers()
      });
      expect(response.statusCode).toBe(404);
    });

    it('list who gave them, most recent first', async () => {
      const project = await publicProject('Stargazed');
      await api.inject({
        method: 'PUT',
        url: `/api/community/projects/${project.link}/star`,
        headers: ada.headers()
      });
      await api.inject({
        method: 'PUT',
        url: `/api/community/projects/${project.link}/star`,
        headers: grace.headers()
      });

      const response = await api.inject({
        method: 'GET',
        url: `/api/community/projects/${project.link}/stargazers`
      });
      expect(response.json().total).toBe(2);
      expect(response.json().entries.map((a: Author) => a.username)).toEqual([
        'Grace',
        'Ada'
      ]);
    });

    it('are listed back to the account that gave them', async () => {
      const project = await publicProject('Collected');
      await api.inject({
        method: 'PUT',
        url: `/api/community/projects/${project.link}/star`,
        headers: grace.headers()
      });

      const mine = await api.inject({
        method: 'GET',
        url: '/api/community/starred/projects?size=100',
        headers: grace.headers()
      });
      expect(mine.json().entries.map((e: CommunityProject) => e.id)).toContain(
        project.id
      );
      // Every row in it is one they starred.
      for (const entry of mine.json().entries) {
        expect(entry.starred).toBe(true);
      }
    });

    it('stop being listed once the document is unpublished', async () => {
      const project = await publicProject('Withdrawn');
      await api.inject({
        method: 'PUT',
        url: `/api/community/projects/${project.link}/star`,
        headers: grace.headers()
      });
      await api.inject({
        method: 'PATCH',
        url: `/api/projects/${project.id}`,
        headers: ada.headers(),
        payload: { public: false }
      });

      const mine = await api.inject({
        method: 'GET',
        url: '/api/community/starred/projects?size=100',
        headers: grace.headers()
      });
      expect(
        mine.json().entries.map((e: CommunityProject) => e.id)
      ).not.toContain(project.id);
    });
  });

  describe('a public profile', () => {
    it('counts only published work and says nothing private', async () => {
      const cookies = await signUp('hopper@example.com', 'Hopper');
      const id = (
        await api.inject({
          method: 'GET',
          url: '/api/user',
          headers: cookies.headers()
        })
      ).json().id;

      await create<ProjectSummary>(
        'projects',
        { name: 'Shown', public: true },
        cookies
      );
      await create<ProjectSummary>('projects', { name: 'Hidden' }, cookies);
      await create<ComponentSummary>(
        'components',
        { name: 'Part', symbol: 'PT', public: true },
        cookies
      );

      const response = await api.inject({
        method: 'GET',
        url: `/api/community/users/${id}`
      });

      expect(response.json()).toMatchObject({
        id,
        username: 'Hopper',
        publicProjects: 1,
        publicComponents: 1
      });
      // A public profile is its own shape, not the account holder's with fields
      // left out.
      expect(response.json().email).toBeUndefined();
      expect(response.json().hasPassword).toBeUndefined();
    });

    it('lists only that user´s published documents', async () => {
      await publicProject('Ada´s');
      await publicProject('Grace´s', grace);

      const response = await api.inject({
        method: 'GET',
        url: `/api/community/users/${adaId}/projects?size=100`
      });
      for (const entry of response.json().entries) {
        expect(entry.author.id).toBe(adaId);
        expect(entry.public).toBe(true);
      }
    });

    it('answers 404 for an unknown or malformed user', async () => {
      for (const id of ['00000000-0000-4000-8000-000000000000', 'nonsense']) {
        const response = await api.inject({
          method: 'GET',
          url: `/api/community/users/${id}`
        });
        expect(response.statusCode).toBe(404);
      }
    });
  });
});
