import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { readFile, stat } from 'node:fs/promises';
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
import { assetFilePath, assetIdOf } from './assets';
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
   * The composed card, as one of its consumers fetches it: an unfurler holds no
   * session, the owner's browser holds theirs, and the two reach the same route.
   */
  function card(
    kind: 'project' | 'component',
    link: string,
    etag?: string,
    as?: CookieJar
  ) {
    return api.inject({
      method: 'GET',
      url: `/api/share/${kind}/${link}/card.png`,
      headers: {
        ...(as?.headers() ?? {}),
        ...(etag ? { 'if-none-match': etag } : {})
      }
    });
  }

  /**
   * A two-level library: `outer` embeds `inner`, and a board embeds `outer`. A
   * one-level graph would pass with no recursion at all.
   */
  /**
   * A preview upload, as the editor sends it: both themes in one request.
   * Answers the light render's URLs, which name the asset.
   */
  async function setPreview(
    kind: 'projects' | 'components',
    id: string
  ): Promise<string[]> {
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
      url: `/api/${kind}/${id}/preview`,
      headers: {
        ...ada.headers(),
        'content-type': request.headers.get('content-type') as string
      },
      payload: Buffer.from(await request.arrayBuffer())
    });
    expect(response.statusCode).toBe(201);
    return response
      .json()
      .preview.light.map((variant: { url: string }) => variant.url);
  }

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
    it('needs no session, because holding the address is the grant', async () => {
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
        url: `/api/share/project/${project.link}`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        kind: 'project',
        project: { id: project.id, name: 'Shared' },
        author: { username: 'Ada' }
      });
      expect(response.json().document.name).toBe('Shared');
    });

    it('answers the tally from the table the document is in', async () => {
      // Two star tables, and the arm that reads the other one is where a
      // copy-paste error hides: a project must not be answered with a
      // component's stars, nor with none at all.
      const project = await create<ProjectSummary>(
        'projects',
        {
          name: 'Starred',
          visibility: 'public',
          document: circuitDocument('Starred', HALF_ADDER_BODY)
        },
        ada
      );
      const component = await create<ComponentSummary>(
        'components',
        {
          name: 'Starred part',
          symbol: 'SP',
          visibility: 'public',
          document: circuitDocument('Starred part', HALF_ADDER_BODY)
        },
        ada
      );

      // Starring is a community action, so it needs the document published and
      // an account that is not the author's.
      await api.inject({
        method: 'PUT',
        url: `/api/community/components/${component.link}/star`,
        headers: grace.headers()
      });

      const sharedProject = await api.inject({
        method: 'GET',
        url: `/api/share/project/${project.link}`
      });
      const sharedComponent = await api.inject({
        method: 'GET',
        url: `/api/share/component/${component.link}`
      });

      expect(sharedProject.json().stars).toBe(0);
      expect(sharedComponent.json().stars).toBe(1);
    });

    it('defaults a document that names no state to unlisted', async () => {
      const project = await create<ProjectSummary>(
        'projects',
        { name: 'Unlisted' },
        ada
      );

      // The state that used to be the boolean's `false`: nobody is told about
      // the document, and the link its owner holds still opens it.
      expect(project.visibility).toBe('unlisted');

      const response = await api.inject({
        method: 'GET',
        url: `/api/share/project/${project.link}`
      });
      expect(response.statusCode).toBe(200);
    });

    it('answers for the table the kind names, not for a token it finds', async () => {
      const component = await create<ComponentSummary>(
        'components',
        {
          name: 'Not a project',
          symbol: 'NAP',
          document: circuitDocument('Not a project', HALF_ADDER_BODY)
        },
        ada
      );

      // The token exists — in the other table. The kind is part of the address,
      // so a component's link addressed as a project names nothing, which is
      // the whole point of carrying it.
      const response = await api.inject({
        method: 'GET',
        url: `/api/share/project/${component.link}`
      });
      expect(response.statusCode).toBe(404);
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
        url: `/api/share/component/${component.link}`
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

      const rotated = await api.inject({
        method: 'PATCH',
        url: `/api/projects/${project.id}`,
        headers: ada.headers(),
        payload: { regenerateLink: true }
      });
      expect(rotated.statusCode).toBe(200);
      expect(rotated.json().link).not.toBe(project.link);

      // Every URL under the old token stops working: that is the revocation,
      // and the new one opens the same document.
      const gone = await api.inject({
        method: 'GET',
        url: `/api/share/project/${project.link}`
      });
      expect(gone.statusCode).toBe(404);

      const now = await api.inject({
        method: 'GET',
        url: `/api/share/project/${rotated.json().link}`
      });
      expect(now.statusCode).toBe(200);
    });

    it('answers 404 for an unknown or malformed token', async () => {
      for (const link of [
        '00000000-0000-4000-8000-000000000000',
        'not-a-uuid'
      ]) {
        const response = await api.inject({
          method: 'GET',
          url: `/api/share/project/${link}`
        });
        // A malformed token is not a comparison the uuid column can make, so
        // it is turned away before it becomes a 500.
        expect(response.statusCode).toBe(404);
      }
    });
  });

  /**
   * The three states, which is what the whole model turns on: an unlisted
   * document is read by whoever holds its address, a private one by its owner
   * alone, and a public one by the community too. Every read addressed by a
   * link carries the same predicate — the share read, its card and its clone —
   * so the states are exercised once here and followed through all three.
   */
  describe('the three states', () => {
    async function withState(
      visibility: 'private' | 'unlisted' | 'public',
      name: string
    ): Promise<ProjectSummary> {
      return create<ProjectSummary>(
        'projects',
        {
          name,
          visibility,
          document: circuitDocument(name, HALF_ADDER_BODY)
        },
        ada
      );
    }

    const read = (link: string, as: CookieJar | null = null) =>
      api.inject({
        method: 'GET',
        url: `/api/share/project/${link}`,
        headers: as?.headers() ?? {}
      });

    it('reads an unlisted document for anybody holding the link', async () => {
      const project = await withState('unlisted', 'Handed out');

      expect((await read(project.link)).statusCode).toBe(200);
      // And it is not in the community listings, which is the whole of what
      // the state buys.
      const listed = await api.inject({
        method: 'GET',
        url: '/api/community/projects?size=100'
      });
      expect(
        listed.json().entries.map((e: ProjectSummary) => e.id)
      ).not.toContain(project.id);
    });

    it('reads a private document for its owner, and for nobody else', async () => {
      const project = await withState('private', 'Owner only');

      expect((await read(project.link)).statusCode).toBe(404);
      expect((await read(project.link, grace)).statusCode).toBe(404);
      expect((await read(project.link, ada)).statusCode).toBe(200);
    });

    it('lets the owner open their own private document´s page', async () => {
      const project = await withState('private', 'Previewed');

      const asVisitor = await api.inject({
        method: 'GET',
        url: `/api/community/projects/${project.link}`
      });
      expect(asVisitor.statusCode).toBe(404);

      // The same URL, with the owner's session: the preview the share dialog
      // promises, at the address the published version would live at.
      const asOwner = await api.inject({
        method: 'GET',
        url: `/api/community/projects/${project.link}`,
        headers: ada.headers()
      });
      expect(asOwner.statusCode).toBe(200);
      expect(asOwner.json()).toMatchObject({
        id: project.id,
        visibility: 'private'
      });
    });

    it('composes a private document´s card for its owner alone', async () => {
      const project = await withState('private', 'Unfurled');

      expect((await card('project', project.link)).statusCode).toBe(404);
      expect(
        (await card('project', project.link, undefined, grace)).statusCode
      ).toBe(404);

      const asOwner = await card('project', project.link, undefined, ada);
      expect(asOwner.statusCode).toBe(200);
      expect(asOwner.headers['content-type']).toBe('image/png');
    });

    it('clones an unlisted document, and refuses a private one', async () => {
      const unlisted = await withState('unlisted', 'Copyable');
      const priv = await withState('private', 'Not copyable');

      expect(
        (
          await api.inject({
            method: 'POST',
            url: `/api/share/project/${unlisted.link}/clone`,
            headers: grace.headers()
          })
        ).statusCode
      ).toBe(201);

      expect(
        (
          await api.inject({
            method: 'POST',
            url: `/api/share/project/${priv.link}/clone`,
            headers: grace.headers()
          })
        ).statusCode
      ).toBe(404);

      // The owner, though, can copy their own out of private — which is what
      // the editor route does when somebody opens a link to their own work.
      expect(
        (
          await api.inject({
            method: 'POST',
            url: `/api/share/project/${priv.link}/clone`,
            headers: ada.headers()
          })
        ).statusCode
      ).toBe(201);
    });

    it('refuses to rotate a published document´s link', async () => {
      const project = await withState('public', 'Published');

      const response = await api.inject({
        method: 'PATCH',
        url: `/api/projects/${project.id}`,
        headers: ada.headers(),
        payload: { regenerateLink: true }
      });

      // The page's own address is this link, so a new token would move a page
      // that is out in the world. The refusal names the state, so a client can
      // say which one it is in.
      expect(response.statusCode).toBe(409);
      expect(response.json().code).toBe('link_published');

      // Nothing about the row changed with it.
      const opened = await api.inject({
        method: 'GET',
        url: `/api/projects/${project.id}`,
        headers: ada.headers()
      });
      expect(opened.json().link).toBe(project.link);
    });

    it('rotates the link once the document is unlisted again', async () => {
      const project = await withState('public', 'Retracted');

      // The two steps the dialog offers instead: out of the listing, then a
      // new token — which is what takes the handed-out URL down.
      await api.inject({
        method: 'PATCH',
        url: `/api/projects/${project.id}`,
        headers: ada.headers(),
        payload: { visibility: 'unlisted' }
      });
      const rotated = await api.inject({
        method: 'PATCH',
        url: `/api/projects/${project.id}`,
        headers: ada.headers(),
        payload: { regenerateLink: true }
      });

      expect(rotated.statusCode).toBe(200);
      expect(rotated.json().link).not.toBe(project.link);
      expect((await read(project.link)).statusCode).toBe(404);
    });

    it('keeps a withdrawn document´s address, so a reshare is the same URL', async () => {
      const project = await withState('unlisted', 'Withdrawn');

      const priv = await api.inject({
        method: 'PATCH',
        url: `/api/projects/${project.id}`,
        headers: ada.headers(),
        payload: { visibility: 'private' }
      });

      // The state is a mask rather than a revocation: the URL is still the
      // document's address and its owner still opens it there, while everybody
      // else gets the answer a private document gets.
      expect(priv.json().link).toBe(project.link);
      expect((await read(project.link)).statusCode).toBe(404);
      expect((await read(project.link, ada)).statusCode).toBe(200);

      // Coming back out restores that same URL, which is why withdrawing and
      // re-sharing is a bookmark's friend rather than its enemy.
      const reopened = await api.inject({
        method: 'PATCH',
        url: `/api/projects/${project.id}`,
        headers: ada.headers(),
        payload: { visibility: 'unlisted' }
      });
      expect(reopened.json().link).toBe(project.link);
      expect((await read(project.link)).statusCode).toBe(200);
    });
  });

  describe('cloning one', () => {
    it('brings the whole transitive library along', async () => {
      const { inner, outer, board } = await publishLibrary();

      const response = await api.inject({
        method: 'POST',
        url: `/api/share/project/${board.link}/clone`,
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
          url: `/api/share/project/${board.link}/clone`,
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
          url: `/api/share/project/${board.link}/clone`,
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

    it('keeps the copy out of every listing, whatever the original was', async () => {
      const project = await create<ProjectSummary>(
        'projects',
        {
          name: 'Public one',
          visibility: 'public',
          document: circuitDocument('Public one', HALF_ADDER_BODY)
        },
        ada
      );

      const clone = (
        await api.inject({
          method: 'POST',
          url: `/api/share/project/${project.link}/clone`,
          headers: grace.headers()
        })
      ).json();

      // Inheriting the visibility would publish somebody else's work under a
      // new owner as a side effect of taking a copy. The copy is unlisted, not
      // private: nobody was told about it, and the cloner's own link works.
      expect(clone.project.visibility).toBe('unlisted');
      const published = await api.inject({
        method: 'GET',
        url: '/api/community/projects?size=100'
      });
      expect(
        published.json().entries.map((e: ProjectSummary) => e.id)
      ).not.toContain(clone.project.id);
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
          url: `/api/share/component/${component.link}/clone`,
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
          url: `/api/share/project/${board.link}/clone`,
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
        url: `/api/share/project/${board.link}/clone`,
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
          url: `/api/share/project/${board.link}/clone`,
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

    it('copies every preview along, so no copy is left a placeholder', async () => {
      const { inner, outer, board } = await publishLibrary();
      const boardPreview = await setPreview('projects', board.id);
      const innerPreview = await setPreview('components', inner.id);

      const clone = (
        await api.inject({
          method: 'POST',
          url: `/api/share/project/${board.link}/clone`,
          headers: grace.headers()
        })
      ).json();

      const copiedInner = clone.dependencies.find(
        (d: ComponentSummary) => d.name === 'Inner'
      );
      const copiedOuter = clone.dependencies.find(
        (d: ComponentSummary) => d.name === 'Outer'
      );
      const lightUrls = (summary: ProjectSummary | ComponentSummary) =>
        summary.preview!.light.map((variant) => variant.url);

      // A master nobody opens needs one as much as the board does: the editor
      // is the only thing that renders, and the cloner may never open it.
      for (const [copy, original] of [
        [clone.project, boardPreview],
        [copiedInner, innerPreview]
      ] as const) {
        const urls = lightUrls(copy);
        expect(assetIdOf(urls[0])).not.toBe(assetIdOf(original[0]));
        for (const url of urls) {
          expect(
            (await readFile(assetFilePath(api, url))).equals(
              await readFile(assetFilePath(api, original[urls.indexOf(url)]))
            )
          ).toBe(true);
        }
      }
      // A source with none clones with none, rather than failing the clone.
      expect(copiedOuter.preview).toBeNull();
      expect(outer.preview).toBeNull();
    });

    it('keeps the copy´s preview when the original replaces its own', async () => {
      const { board } = await publishLibrary();
      await setPreview('projects', board.id);

      const clone = (
        await api.inject({
          method: 'POST',
          url: `/api/share/project/${board.link}/clone`,
          headers: grace.headers()
        })
      ).json();
      await setPreview('projects', board.id);

      // Two pointers at one directory would lose the copy's files here, the
      // replace deleting the asset it moved away from.
      for (const variant of clone.project.preview.light) {
        await expect(
          stat(assetFilePath(api, variant.url))
        ).resolves.toBeTruthy();
      }
    });

    it('needs a session', async () => {
      const project = await create<ProjectSummary>(
        'projects',
        { name: 'Needs auth' },
        ada
      );

      const response = await api.inject({
        method: 'POST',
        url: `/api/share/project/${project.link}/clone`
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('the card it unfurls as', () => {
    it('answers a picture at the size every share surface expects', async () => {
      const project = await create<ProjectSummary>(
        'projects',
        { name: 'Card', document: circuitDocument('Card', HALF_ADDER_BODY) },
        ada
      );

      // No session: a card is fetched by whatever unfurls the link, and the
      // document is unlisted, so holding the address is what it takes.
      const response = await card('project', project.link);

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

      const before = await card('project', project.link);
      await setPreview('projects', project.id);
      const after = await card('project', project.link);

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

      const first = await card('project', project.link);
      const etag = first.headers['etag'] as string;
      expect(etag).toBeTruthy();

      const unchanged = await card('project', project.link, etag);
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
      const renamed = await card('project', project.link, etag);
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

      const response = await card('component', component.link);
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
    });

    it('is a 404 for a link that names nothing', async () => {
      const response = await card(
        'project',
        '00000000-0000-4000-8000-000000000000'
      );

      expect(response.statusCode).toBe(404);
      expect(response.json().code).toBe('not_found');
    });
  });
});
