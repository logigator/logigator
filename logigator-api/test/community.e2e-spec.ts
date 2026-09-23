import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  Author,
  CommunityProject,
  ComponentSummary,
  ProjectSummary
} from '@logigator/contract';
import { eq, sql } from 'drizzle-orm';
import { projectStars } from '../src/database/schema';
import { circuitDocument, EMPTY_BODY, HALF_ADDER_BODY } from './circuits';
import { CookieJar } from './cookie-jar';
import { startE2eApp, type E2eApp } from './harness';

describe('the community surface', () => {
  let api: E2eApp;
  let ada: CookieJar;
  let adaId: string;
  let grace: CookieJar;
  let graceId: string;

  /**
   * A registered, signed-in member.
   *
   * **At most five per spec file**: registration is rate-limited per address,
   * and every request here comes from one. The status is asserted rather than
   * discarded, so a sixth is a rate-limit failure at this line instead of a
   * member with no session in whichever test asked for one.
   */
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

  /**
   * Ages every star on a project. A ranking that reads a window can only be
   * exercised against stars outside it, and there is no request that makes one
   * old — so the rows are moved rather than the clock.
   */
  const backdateStars = (projectId: string, days: number) =>
    api.db
      .update(projectStars)
      .set({ starredAt: sql`now() - make_interval(days => ${days})` })
      .where(eq(projectStars.projectId, projectId));

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
    graceId = (
      await api.inject({
        method: 'GET',
        url: '/api/user',
        headers: grace.headers()
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
        payload: { visibility: 'unlisted' }
      });

      const response = await api.inject({
        method: 'GET',
        url: '/api/community/projects'
      });
      expect(
        response.json().entries.map((e: CommunityProject) => e.id)
      ).not.toContain(project.id);
    });

    it('leave out a published document with nothing on it, everywhere', async () => {
      const blank = await create<ProjectSummary>(
        'projects',
        { name: 'Blank board', visibility: 'public' },
        ada
      );
      const blankPart = await create<ComponentSummary>(
        'components',
        { name: 'Blank part', symbol: 'BP', visibility: 'public' },
        ada
      );
      // A lone wire is not nothing: the rule is "empty", not "useful".
      const wired = await create<ProjectSummary>(
        'projects',
        {
          name: 'Just a wire',
          visibility: 'public',
          document: circuitDocument('Just a wire', {
            components: [],
            wires: [{ pos: [0, 0], direction: 0, length: 3 }]
          })
        },
        ada
      );
      await api.inject({
        method: 'PUT',
        url: `/api/community/projects/${blank.link}/star`,
        headers: grace.headers()
      });

      const ids = async (url: string, cookies?: CookieJar) =>
        (await api.inject({ method: 'GET', url, headers: cookies?.headers() }))
          .json()
          .entries.map((e: { id: string }) => e.id);

      for (const url of [
        '/api/community/projects?size=100',
        '/api/community/projects?search=Blank&size=100',
        `/api/community/users/${adaId}/projects?size=100`,
        `/api/community/users/${graceId}/starred/projects?size=100`
      ]) {
        const listed = await ids(url);
        expect(listed, url).not.toContain(blank.id);
      }
      expect(
        await ids('/api/community/starred/projects?size=100', grace)
      ).not.toContain(blank.id);
      for (const url of [
        '/api/community/components?size=100',
        `/api/community/users/${adaId}/components?size=100`
      ]) {
        expect(await ids(url), url).not.toContain(blankPart.id);
      }
      expect(await ids('/api/community/projects?size=100')).toContain(wired.id);

      // It is left unadvertised, not unpublished: its link still opens it.
      const page = await api.inject({
        method: 'GET',
        url: `/api/community/projects/${blank.link}`
      });
      expect(page.statusCode).toBe(200);

      // And the rule follows the document: drawing on it lists it, clearing it
      // again takes it back out.
      const save = (version: number, body = HALF_ADDER_BODY) =>
        api.inject({
          method: 'PUT',
          url: `/api/projects/${blank.id}`,
          headers: ada.headers(),
          payload: { version, document: circuitDocument('Blank board', body) }
        });
      const drawn = await save(blank.version);
      expect(drawn.statusCode).toBe(200);
      expect(await ids('/api/community/projects?size=100')).toContain(blank.id);

      expect((await save(drawn.json().version, EMPTY_BODY)).statusCode).toBe(
        200
      );
      expect(await ids('/api/community/projects?size=100')).not.toContain(
        blank.id
      );
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
        url: '/api/community/projects?orderBy=stars&size=100'
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

    it('rank by trending unasked, putting a recent star over an old tally', async () => {
      // Two stars from long ago against one from today. Ranked by the lifetime
      // tally the old favourite wins; the default ranking is what the window
      // changes, and this is the pair that tells the two apart.
      const oldFavourite = await publicProject('Popular back then');
      const rising = await publicProject('Popular now');

      for (const [project, who] of [
        [oldFavourite, ada],
        [oldFavourite, grace],
        [rising, grace]
      ] as const) {
        await api.inject({
          method: 'PUT',
          url: `/api/community/projects/${project.link}/star`,
          headers: who.headers()
        });
      }
      await backdateStars(oldFavourite.id, 90);

      const byStars = await api.inject({
        method: 'GET',
        url: '/api/community/projects?orderBy=stars&size=100'
      });
      const tally = byStars.json().entries.map((e: CommunityProject) => e.id);
      expect(tally.indexOf(oldFavourite.id)).toBeLessThan(
        tally.indexOf(rising.id)
      );

      const trending = await api.inject({
        method: 'GET',
        url: '/api/community/projects?size=100'
      });
      const ranked = trending.json().entries.map((e: CommunityProject) => e.id);
      expect(ranked.indexOf(rising.id)).toBeLessThan(
        ranked.indexOf(oldFavourite.id)
      );
    });

    it('fall back to the lifetime tally where the window is empty', async () => {
      // The day this ships every star is older than nothing, so trending has to
      // degenerate to exactly the stars-then-newest order rather than to noise.
      const starred = await publicProject('Starred long ago');
      const unstarred = await publicProject('Never starred');
      await api.inject({
        method: 'PUT',
        url: `/api/community/projects/${starred.link}/star`,
        headers: grace.headers()
      });
      await backdateStars(starred.id, 400);

      const trending = await api.inject({
        method: 'GET',
        url: '/api/community/projects?size=100'
      });
      const ranked = trending.json().entries.map((e: CommunityProject) => e.id);
      expect(ranked.indexOf(starred.id)).toBeLessThan(
        ranked.indexOf(unstarred.id)
      );
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

      // Out of the listing first, which is what a published document allows
      // before its link may be rotated.
      await api.inject({
        method: 'PATCH',
        url: `/api/projects/${project.id}`,
        headers: ada.headers(),
        payload: { visibility: 'unlisted' }
      });
      await api.inject({
        method: 'PATCH',
        url: `/api/projects/${project.id}`,
        headers: ada.headers(),
        payload: { regenerateLink: true }
      });

      // Regenerating the token takes the page with it.
      const gone = await api.inject({
        method: 'GET',
        url: `/api/community/projects/${project.link}`
      });
      expect(gone.statusCode).toBe(404);
    });

    it('serves an unlisted document by its link, but only its owner a private one', async () => {
      // The state this page gained: a document that is not in the listing still
      // has an address, because its link is what its owner hands out.
      const unlisted = await create<ProjectSummary>(
        'projects',
        { name: 'Handed out' },
        ada
      );
      const listing = await api.inject({
        method: 'GET',
        url: '/api/community/projects?size=100'
      });
      expect(
        listing.json().entries.map((e: CommunityProject) => e.id)
      ).not.toContain(unlisted.id);

      const page = await api.inject({
        method: 'GET',
        url: `/api/community/projects/${unlisted.link}`
      });
      expect(page.statusCode).toBe(200);
      expect(page.json().visibility).toBe('unlisted');

      // A private document has no page for anybody but its owner: the state
      // withholds the address, which is a 404 rather than a page that happens
      // to have no star button.
      const priv = await create<ProjectSummary>(
        'projects',
        { name: 'Owner only', visibility: 'private' },
        ada
      );
      const asVisitor = await api.inject({
        method: 'GET',
        url: `/api/community/projects/${priv.link}`
      });
      expect(asVisitor.statusCode).toBe(404);

      const asOwner = await api.inject({
        method: 'GET',
        url: `/api/community/projects/${priv.link}`,
        headers: ada.headers()
      });
      expect(asOwner.statusCode).toBe(200);
      expect(asOwner.json()).toMatchObject({
        id: priv.id,
        visibility: 'private'
      });
    });

    it('credits the document it was forked from', async () => {
      const original = await publicProject('Ancestor');
      const clone = (
        await api.inject({
          method: 'POST',
          url: `/api/share/project/${original.link}/clone`,
          headers: grace.headers()
        })
      ).json();

      await api.inject({
        method: 'PATCH',
        url: `/api/projects/${clone.project.id}`,
        headers: grace.headers(),
        payload: { visibility: 'public' }
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

    it('cannot be given to anything but a published document', async () => {
      // The two rules are separate on purpose: a link resolves for an unlisted
      // document, and a star is not something a link gets you. Both states are
      // checked because loosening the star's guard to the read's predicate is
      // the mistake this pair exists to catch.
      for (const visibility of ['unlisted', 'private'] as const) {
        const project = await create<ProjectSummary>(
          'projects',
          // Within the name column's 20 characters for both states.
          { name: `Hidden ${visibility}`, visibility },
          ada
        );

        const response = await api.inject({
          method: 'PUT',
          url: `/api/community/projects/${project.link}/star`,
          headers: grace.headers()
        });
        expect(response.statusCode).toBe(404);

        // Not even by the owner: the counter is a listing's, and this document
        // is not in one.
        const own = await api.inject({
          method: 'PUT',
          url: `/api/community/projects/${project.link}/star`,
          headers: ada.headers()
        });
        expect(own.statusCode).toBe(404);
      }
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

    it('are listed publicly, with the caller’s own flag on each row', async () => {
      // The two accounts are what makes this a real check: the rows are
      // Grace's stars, but `starred` has to answer for whoever is reading, or
      // a visitor's star control on somebody else's tab reads inverted.
      const project = await publicProject('On somebody’s shelf');
      await api.inject({
        method: 'PUT',
        url: `/api/community/projects/${project.link}/star`,
        headers: grace.headers()
      });

      const anonymous = await api.inject({
        method: 'GET',
        url: `/api/community/users/${graceId}/starred/projects?size=100`
      });
      expect(anonymous.statusCode).toBe(200);
      const seen = anonymous
        .json()
        .entries.find((e: CommunityProject) => e.id === project.id);
      expect(seen).toMatchObject({ starred: false });

      const asAda = await api.inject({
        method: 'GET',
        url: `/api/community/users/${graceId}/starred/projects?size=100`,
        headers: ada.headers()
      });
      expect(
        asAda.json().entries.find((e: CommunityProject) => e.id === project.id)
          .starred
      ).toBe(false);

      const asGrace = await api.inject({
        method: 'GET',
        url: `/api/community/users/${graceId}/starred/projects?size=100`,
        headers: grace.headers()
      });
      expect(
        asGrace
          .json()
          .entries.find((e: CommunityProject) => e.id === project.id).starred
      ).toBe(true);
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
        payload: { visibility: 'unlisted' }
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
        {
          name: 'Shown',
          visibility: 'public',
          document: circuitDocument('Shown', HALF_ADDER_BODY)
        },
        cookies
      );
      await create<ProjectSummary>(
        'projects',
        {
          name: 'Hidden',
          document: circuitDocument('Hidden', HALF_ADDER_BODY)
        },
        cookies
      );
      await create<ComponentSummary>(
        'components',
        {
          name: 'Part',
          symbol: 'PT',
          visibility: 'public',
          document: circuitDocument('Part', HALF_ADDER_BODY)
        },
        cookies
      );
      // Published but blank: in no listing, so in no count either — the number
      // on the profile has to match the tab it heads.
      await create<ProjectSummary>(
        'projects',
        { name: 'Blank', visibility: 'public' },
        cookies
      );
      await create<ComponentSummary>(
        'components',
        { name: 'Blank part', symbol: 'BP', visibility: 'public' },
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

    it('carries the bio, the website and the classified links', async () => {
      const cookies = await signUp('enrich@example.com', 'Enrich');
      const id = (
        await api.inject({
          method: 'GET',
          url: '/api/user',
          headers: cookies.headers()
        })
      ).json().id;

      await api.inject({
        method: 'PATCH',
        url: '/api/user',
        headers: cookies.headers(),
        payload: {
          bio: 'I build adders out of relays.',
          websiteUrl: 'https://ada.example/',
          socialLinks: ['https://github.com/ada', 'https://fosstodon.org/@ada']
        }
      });

      const response = await api.inject({
        method: 'GET',
        url: `/api/community/users/${id}`
      });

      // Classified on read, by the same rule the account's own view uses — the
      // public page and the account page cannot disagree about what a link is.
      expect(response.json()).toMatchObject({
        bio: 'I build adders out of relays.',
        websiteUrl: 'https://ada.example/',
        socialLinks: [
          { url: 'https://github.com/ada', platform: 'github' },
          { url: 'https://fosstodon.org/@ada', platform: 'mastodon' }
        ]
      });
      // Nothing private travels with them.
      expect(response.json().email).toBeUndefined();
    });

    it('counts the stars its published work received, and no others', async () => {
      const cookies = await signUp('counted@example.com', 'Counted');
      const id = (
        await api.inject({
          method: 'GET',
          url: '/api/user',
          headers: cookies.headers()
        })
      ).json().id;

      const shown = await create<ProjectSummary>(
        'projects',
        {
          name: 'Loved',
          visibility: 'public',
          document: circuitDocument('Loved', HALF_ADDER_BODY)
        },
        cookies
      );
      const hidden = await create<ProjectSummary>(
        'projects',
        { name: 'Secret' },
        cookies
      );
      expect(hidden.visibility).not.toBe('public');

      await api.inject({
        method: 'PUT',
        url: `/api/community/projects/${shown.link}/star`,
        headers: grace.headers()
      });

      // A star on a document nobody may read. The public route refuses to set
      // one on a private document, so the row is written where such a star
      // would come from — a row that predates the document being unpublished,
      // or one a later change put out of reach.
      await api.db.insert(projectStars).values({
        userId: graceId,
        projectId: hidden.id
      });

      const response = await api.inject({
        method: 'GET',
        url: `/api/community/users/${id}`
      });

      // One, not two: `visibility = 'public'` is what makes the tally a count
      // of published work rather than of everything the member owns.
      expect(response.json().stars).toBe(1);

      // And it follows the document: withdrawing it takes its stars off the
      // profile, the way it takes them off every listing.
      await api.inject({
        method: 'PATCH',
        url: `/api/projects/${shown.id}`,
        headers: cookies.headers(),
        payload: { visibility: 'private' }
      });

      const after = await api.inject({
        method: 'GET',
        url: `/api/community/users/${id}`
      });
      expect(after.json().stars).toBe(0);
    });

    it('counts stars received, not stars given', async () => {
      const tally = async () =>
        (
          await api.inject({
            method: 'GET',
            url: `/api/community/users/${graceId}`
          })
        ).json().stars as number;

      const before = await tally();

      // Something of somebody else's to star. Grace's own number is what is
      // asserted below, and it reads before and after rather than as a figure:
      // what is being tested is that giving a star does not move the giver's
      // own profile, whatever either number happens to be.
      const hers = await publicProject('Ada´s gift');
      const given = await api.inject({
        method: 'PUT',
        url: `/api/community/projects/${hers.link}/star`,
        headers: grace.headers()
      });

      // The star landed — asserted, so the comparison below is about where the
      // tally did not move rather than about a request that never happened.
      expect(given.json()).toEqual({ starred: true, stars: 1 });
      expect(await tally()).toBe(before);
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
        expect(entry.visibility).toBe('public');
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
