import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { CUSTOM_TYPE_ID_BASE } from '@logigator/core';
import type { ComponentSummary, ProjectSummary } from '@logigator/contract';
import { components, componentDependencies } from '../src/database/schema';
import {
  circuitDocument,
  gate,
  HALF_ADDER_BODY,
  serverSnapshot
} from './circuits';
import { CookieJar } from './cookie-jar';
import { startE2eApp, type E2eApp } from './harness';

const MODEL = CUSTOM_TYPE_ID_BASE;

describe('share links', () => {
  let api: E2eApp;
  /** The publisher, whose documents are shared. */
  let ada: CookieJar;
  /** The cloner, who has nothing of their own. */
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

  /**
   * A two-level library: `outer` embeds `inner`, and a board embeds `outer`. A
   * one-level graph would pass with no recursion at all.
   */
  async function publishLibrary(): Promise<{
    inner: ComponentSummary;
    outer: ComponentSummary;
    board: ProjectSummary;
  }> {
    const inner = await create<ComponentSummary>(
      'components',
      {
        name: 'Inner',
        symbol: 'IN',
        document: circuitDocument('Inner', HALF_ADDER_BODY)
      },
      ada
    );

    const outer = await create<ComponentSummary>(
      'components',
      {
        name: 'Outer',
        symbol: 'OUT',
        document: circuitDocument(
          'Outer',
          {
            components: [...HALF_ADDER_BODY.components, gate(MODEL, 10, 0)],
            wires: HALF_ADDER_BODY.wires
          },
          [
            serverSnapshot({
              type: MODEL,
              masterId: inner.id,
              version: inner.version,
              name: 'Inner'
            })
          ]
        )
      },
      ada
    );

    const board = await create<ProjectSummary>(
      'projects',
      {
        name: 'Board',
        document: circuitDocument(
          'Board',
          { components: [gate(MODEL, 2, 2)], wires: [] },
          [
            serverSnapshot({
              type: MODEL,
              masterId: outer.id,
              version: outer.version,
              name: 'Outer'
            })
          ]
        )
      },
      ada
    );

    return { inner, outer, board };
  }

  beforeAll(async () => {
    api = await startE2eApp();
    ada = await signUp('ada@example.com', 'Ada');
    grace = await signUp('grace@example.com', 'Grace');
  });

  afterAll(async () => {
    await api.close();
  });

  describe('reading one', () => {
    it('needs no session, because the link is the grant', async () => {
      const project = await create<ProjectSummary>(
        'projects',
        {
          name: 'Shared',
          document: circuitDocument('Shared', HALF_ADDER_BODY)
        },
        ada
      );

      const response = await api.inject({
        method: 'GET',
        url: `/api/share/${project.link}`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        kind: 'project',
        project: { id: project.id, name: 'Shared' },
        author: { username: 'Ada' }
      });
      expect(response.json().document.name).toBe('Shared');
    });

    it('does not consult the public flag', async () => {
      const project = await create<ProjectSummary>(
        'projects',
        { name: 'Unlisted' },
        ada
      );
      expect(project.public).toBe(false);

      // Holding the URL *is* the grant, so a share works with no account.
      const response = await api.inject({
        method: 'GET',
        url: `/api/share/${project.link}`
      });
      expect(response.statusCode).toBe(200);
    });

    it('resolves a component link to a component', async () => {
      const component = await create<ComponentSummary>(
        'components',
        {
          name: 'Shared part',
          symbol: 'SP',
          document: circuitDocument('Shared part', HALF_ADDER_BODY)
        },
        ada
      );

      const response = await api.inject({
        method: 'GET',
        url: `/api/share/${component.link}`
      });
      expect(response.json()).toMatchObject({
        kind: 'component',
        component: { id: component.id, numInputs: 2, numOutputs: 1 }
      });
    });

    it('stops resolving once the token is regenerated', async () => {
      const project = await create<ProjectSummary>(
        'projects',
        { name: 'Revoked' },
        ada
      );

      await api.inject({
        method: 'PATCH',
        url: `/api/projects/${project.id}`,
        headers: ada.headers(),
        payload: { regenerateLink: true }
      });

      // Every URL under the old token stops working: that is the revocation.
      const response = await api.inject({
        method: 'GET',
        url: `/api/share/${project.link}`
      });
      expect(response.statusCode).toBe(404);
    });

    it('answers 404 for an unknown or malformed token', async () => {
      for (const link of [
        '00000000-0000-4000-8000-000000000000',
        'not-a-uuid'
      ]) {
        const response = await api.inject({
          method: 'GET',
          url: `/api/share/${link}`
        });
        // A malformed token is not a comparison the uuid column can make, so
        // it is turned away before it becomes a 500.
        expect(response.statusCode).toBe(404);
      }
    });
  });

  describe('cloning one', () => {
    it('brings the whole transitive library along', async () => {
      const { inner, outer, board } = await publishLibrary();

      const response = await api.inject({
        method: 'POST',
        url: `/api/share/${board.link}/clone`,
        headers: grace.headers()
      });

      expect(response.statusCode).toBe(201);
      const clone = response.json();
      expect(clone.kind).toBe('project');
      // Two levels deep: a one-level graph would pass with no recursion at all.
      expect(clone.dependencies).toHaveLength(2);
      expect(
        clone.dependencies.map((d: ComponentSummary) => d.name).sort()
      ).toEqual(['Inner', 'Outer']);

      // Copies, not the originals.
      for (const copy of clone.dependencies) {
        expect([inner.id, outer.id]).not.toContain(copy.id);
      }
      expect(clone.project.id).not.toBe(board.id);
    });

    it('re-points every embedded snapshot at the copy of its master', async () => {
      const { board } = await publishLibrary();

      const clone = (
        await api.inject({
          method: 'POST',
          url: `/api/share/${board.link}/clone`,
          headers: grace.headers()
        })
      ).json();

      const copiedOuter = clone.dependencies.find(
        (d: ComponentSummary) => d.name === 'Outer'
      );
      const copiedInner = clone.dependencies.find(
        (d: ComponentSummary) => d.name === 'Inner'
      );

      // The board's snapshot of Outer names the *copy*, or the clone hears
      // about updates to somebody else's component and never its own.
      const opened = await api.inject({
        method: 'GET',
        url: `/api/projects/${clone.project.id}`,
        headers: grace.headers()
      });
      expect(opened.json().document.definitions[0].source.id).toBe(
        copiedOuter.id
      );
      expect(opened.json().dependencies[0].id).toBe(copiedOuter.id);

      // And one level down: the copied Outer points at the copied Inner.
      const [outerRow] = await api.db
        .select()
        .from(components)
        .where(eq(components.id, copiedOuter.id));
      expect(outerRow.document.definitions?.[0]?.source?.id).toBe(
        copiedInner.id
      );

      const edges = await api.db
        .select()
        .from(componentDependencies)
        .where(eq(componentDependencies.dependentId, copiedOuter.id));
      expect(edges.map((edge) => edge.dependencyId)).toEqual([copiedInner.id]);
    });

    it('records what each copy came from, so attribution resolves', async () => {
      const { board } = await publishLibrary();

      const clone = (
        await api.inject({
          method: 'POST',
          url: `/api/share/${board.link}/clone`,
          headers: grace.headers()
        })
      ).json();

      const opened = await api.inject({
        method: 'GET',
        url: `/api/projects/${clone.project.id}`,
        headers: grace.headers()
      });
      expect(opened.json().attribution).toEqual([
        { projectId: board.id, projectName: 'Board', authorName: 'Ada' }
      ]);
    });

    it('keeps the copy private whatever the original was', async () => {
      const project = await create<ProjectSummary>(
        'projects',
        { name: 'Public one', public: true },
        ada
      );

      const clone = (
        await api.inject({
          method: 'POST',
          url: `/api/share/${project.link}/clone`,
          headers: grace.headers()
        })
      ).json();

      // Inheriting the visibility would republish somebody else's work under a
      // new owner.
      expect(clone.project.public).toBe(false);
    });

    it('re-derives a copied component´s ports rather than copying them', async () => {
      const component = await create<ComponentSummary>(
        'components',
        {
          name: 'Ported',
          symbol: 'PRT',
          document: circuitDocument('Ported', HALF_ADDER_BODY)
        },
        ada
      );

      const clone = (
        await api.inject({
          method: 'POST',
          url: `/api/share/${component.link}/clone`,
          headers: grace.headers()
        })
      ).json();

      expect(clone.kind).toBe('component');
      expect(clone.component).toMatchObject({
        numInputs: 2,
        numOutputs: 1,
        labels: ['A', 'B', 'S']
      });
    });

    it('gives the cloner rows they own and can edit', async () => {
      const { board } = await publishLibrary();
      // Their own account, so the listing below is the clone and nothing else.
      const newcomer = await signUp('newcomer@example.com', 'Newcomer');

      const clone = (
        await api.inject({
          method: 'POST',
          url: `/api/share/${board.link}/clone`,
          headers: newcomer.headers()
        })
      ).json();

      // Why the library is cloned too: the cloner needs masters of their own
      // to keep editing.
      const listed = await api.inject({
        method: 'GET',
        url: '/api/components',
        headers: newcomer.headers()
      });
      expect(
        listed
          .json()
          .entries.map((c: ComponentSummary) => c.name)
          .sort()
      ).toEqual(['Inner', 'Outer']);

      const saved = await api.inject({
        method: 'PUT',
        url: `/api/projects/${clone.project.id}`,
        headers: newcomer.headers(),
        payload: {
          version: clone.project.version,
          document: circuitDocument('Board', HALF_ADDER_BODY)
        }
      });
      expect(saved.statusCode).toBe(200);
    });

    it('leaves the original untouched', async () => {
      const { board, inner } = await publishLibrary();

      await api.inject({
        method: 'POST',
        url: `/api/share/${board.link}/clone`,
        headers: grace.headers()
      });

      const opened = await api.inject({
        method: 'GET',
        url: `/api/projects/${board.id}`,
        headers: ada.headers()
      });
      expect(opened.json()).toMatchObject({ version: board.version });
      expect(opened.json().document.definitions[0].source.id).not.toBe(
        inner.id
      );
    });

    it('drops a snapshot´s source when its master is gone', async () => {
      const { board, outer } = await publishLibrary();

      await api.inject({
        method: 'DELETE',
        url: `/api/components/${outer.id}`,
        headers: ada.headers()
      });

      const clone = (
        await api.inject({
          method: 'POST',
          url: `/api/share/${board.link}/clone`,
          headers: grace.headers()
        })
      ).json();

      // Nothing to point at, and a snapshot without a source is already the
      // format's "self-contained".
      expect(clone.dependencies).toEqual([]);
      const opened = await api.inject({
        method: 'GET',
        url: `/api/projects/${clone.project.id}`,
        headers: grace.headers()
      });
      expect(opened.json().document.definitions[0].source).toBeUndefined();
      expect(opened.json().componentCount).toBe(1);
    });

    it('needs a session', async () => {
      const project = await create<ProjectSummary>(
        'projects',
        { name: 'Needs auth' },
        ada
      );

      const response = await api.inject({
        method: 'POST',
        url: `/api/share/${project.link}/clone`
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('the card it unfurls as', () => {
    /** A preview upload, as the editor sends it: both themes in one request. */
    async function setPreview(id: string): Promise<void> {
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

      const response = await api.inject({
        method: 'POST',
        url: `/api/projects/${id}/preview`,
        headers: {
          ...ada.headers(),
          'content-type': request.headers.get('content-type') as string
        },
        payload: Buffer.from(await request.arrayBuffer())
      });
      expect(response.statusCode).toBe(201);
    }

    function card(link: string, etag?: string) {
      return api.inject({
        method: 'GET',
        url: `/api/share/${link}/card.png`,
        headers: etag ? { 'if-none-match': etag } : {}
      });
    }

    it('answers a picture at the size every share surface expects', async () => {
      const project = await create<ProjectSummary>(
        'projects',
        { name: 'Card', document: circuitDocument('Card', HALF_ADDER_BODY) },
        ada
      );

      // No session: the link is the capability here as much as it is for the
      // document, which is what lets one route serve every unfurler.
      const response = await card(project.link);

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
      expect(response.headers['cache-control']).toContain('max-age=');
      const { width, height } = await sharp(response.rawPayload).metadata();
      expect({ width, height }).toEqual({ width: 1200, height: 630 });
    });

    it('composes the stored render into it', async () => {
      const project = await create<ProjectSummary>(
        'projects',
        { name: 'Rendered', document: circuitDocument('Rendered') },
        ada
      );

      const before = await card(project.link);
      await setPreview(project.id);
      const after = await card(project.link);

      // The picture is in the card, so a preview upload changes both the
      // drawing and the tag — the asset id is part of what is hashed.
      expect(after.headers['etag']).not.toBe(before.headers['etag']);
      expect(after.rawPayload.equals(before.rawPayload)).toBe(false);
    });

    it('is revalidated by its tag, and re-composed when an input moves', async () => {
      const project = await create<ProjectSummary>(
        'projects',
        { name: 'Tagged', document: circuitDocument('Tagged') },
        ada
      );

      const first = await card(project.link);
      const etag = first.headers['etag'] as string;
      expect(etag).toBeTruthy();

      const unchanged = await card(project.link, etag);
      expect(unchanged.statusCode).toBe(304);
      expect(unchanged.rawPayload.length).toBe(0);

      await api.inject({
        method: 'PATCH',
        url: `/api/projects/${project.id}`,
        headers: ada.headers(),
        payload: { name: 'Renamed' }
      });

      // A rename is drawn on the card, so the tag a client holds has to stop
      // matching — that is the whole of what keeps an on-demand card fresh.
      const renamed = await card(project.link, etag);
      expect(renamed.statusCode).toBe(200);
    });

    it('draws a library component from its symbol', async () => {
      const component = await create<ComponentSummary>(
        'components',
        {
          name: 'Adder',
          symbol: 'ADD',
          document: circuitDocument('Adder', HALF_ADDER_BODY)
        },
        ada
      );

      const response = await card(component.link);
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
    });

    it('is a 404 for a link that names nothing', async () => {
      const response = await card('00000000-0000-4000-8000-000000000000');

      expect(response.statusCode).toBe(404);
      expect(response.json().code).toBe('not_found');
    });
  });
});
