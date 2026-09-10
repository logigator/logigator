import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import type { ComponentSummary, ProjectSummary } from '@logigator/contract';
import {
  BuiltInComponentType,
  CURRENT_FILE_VERSION,
  CUSTOM_TYPE_ID_BASE
} from '@logigator/core';
import { projectDependencies, projects } from '../src/database/schema';
import {
  circuitDocument,
  EMPTY_BODY,
  gate,
  HALF_ADDER_BODY,
  plug,
  serverSnapshot
} from './circuits';
import { CookieJar } from './cookie-jar';
import { startE2eApp, type E2eApp } from './harness';
import { whileRowLocked } from './row-lock';

describe('stored circuits', () => {
  let api: E2eApp;
  let jar: CookieJar;
  let otherJar: CookieJar;

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

  /** Creates a project and answers its summary, failing loudly if it did not. */
  async function createProject(
    payload: Record<string, unknown>,
    cookies = jar
  ): Promise<ProjectSummary> {
    const response = await api.inject({
      method: 'POST',
      url: '/api/projects',
      headers: cookies.headers(),
      payload
    });
    expect(response.statusCode).toBe(201);
    return response.json();
  }

  async function createComponent(
    payload: Record<string, unknown>,
    cookies = jar
  ): Promise<ComponentSummary> {
    const response = await api.inject({
      method: 'POST',
      url: '/api/components',
      headers: cookies.headers(),
      payload
    });
    expect(response.statusCode).toBe(201);
    return response.json();
  }

  beforeAll(async () => {
    api = await startE2eApp();
    jar = await signUp('ada@example.com', 'Ada');
    otherJar = await signUp('grace@example.com', 'Grace');
  });

  afterAll(async () => {
    await api.close();
  });

  describe('creating', () => {
    it('starts a project on an empty current-version board', async () => {
      const created = await createProject({ name: 'Empty' });

      expect(created).toMatchObject({
        name: 'Empty',
        description: '',
        public: false,
        version: 1,
        componentCount: 0,
        wireCount: 0,
        preview: null
      });
      expect(created.link).toMatch(/^[0-9a-f-]{36}$/);

      const opened = await api.inject({
        method: 'GET',
        url: `/api/projects/${created.id}`,
        headers: jar.headers()
      });
      expect(opened.json().document.version).toBe(CURRENT_FILE_VERSION);
    });

    it('derives the counts from a document it was handed', async () => {
      const created = await createProject({
        name: 'Half adder',
        document: circuitDocument('whatever', HALF_ADDER_BODY)
      });

      expect(created).toMatchObject({ componentCount: 4, wireCount: 2 });
    });

    it('names the row from the request, not from the document', async () => {
      const created = await createProject({
        name: 'The real name',
        document: circuitDocument('a name from a file', HALF_ADDER_BODY)
      });

      expect(created.name).toBe('The real name');
      const opened = await api.inject({
        method: 'GET',
        url: `/api/projects/${created.id}`,
        headers: jar.headers()
      });
      // The column and the document's copy of the name cannot disagree.
      expect(opened.json().document.name).toBe('The real name');
    });

    it('rejects a name longer than the column holds', async () => {
      const response = await api.inject({
        method: 'POST',
        url: '/api/projects',
        headers: jar.headers(),
        payload: { name: 'x'.repeat(21) }
      });

      expect(response.statusCode).toBe(422);
      expect(Object.keys(response.json().details)).toEqual(['name']);
    });
  });

  describe("a component's ports", () => {
    it('come from its circuit, never from the request', async () => {
      const created = await createComponent({
        name: 'Half adder',
        symbol: 'HA',
        // Whatever a client might claim about the ports, the plugs decide.
        numInputs: 99,
        numOutputs: 99,
        labels: ['lies'],
        document: circuitDocument('Half adder', HALF_ADDER_BODY)
      });

      expect(created).toMatchObject({
        symbol: 'HA',
        numInputs: 2,
        numOutputs: 1,
        labels: ['A', 'B', 'S']
      });
    });

    it('are re-derived when the circuit changes', async () => {
      const created = await createComponent({
        name: 'Growing',
        symbol: 'GRW',
        document: circuitDocument('Growing', HALF_ADDER_BODY)
      });

      const saved = await api.inject({
        method: 'PUT',
        url: `/api/components/${created.id}`,
        headers: jar.headers(),
        payload: {
          version: created.version,
          document: circuitDocument('Growing', {
            components: [
              ...HALF_ADDER_BODY.components,
              plug(BuiltInComponentType.OUTPUT, 1, 'C')
            ],
            wires: HALF_ADDER_BODY.wires
          })
        }
      });

      expect(saved.statusCode).toBe(200);
      expect(saved.json()).toMatchObject({
        numOutputs: 2,
        labels: ['A', 'B', 'S', 'C']
      });
    });

    it('are ordered by the plug index, not by document order', async () => {
      const created = await createComponent({
        name: 'Ordered',
        symbol: 'ORD',
        document: circuitDocument('Ordered', {
          components: [
            plug(BuiltInComponentType.INPUT, 2, 'C'),
            plug(BuiltInComponentType.INPUT, 0, 'A'),
            plug(BuiltInComponentType.INPUT, 1, 'B')
          ],
          wires: []
        })
      });

      expect(created.labels).toEqual(['A', 'B', 'C']);
    });
  });

  describe('saving', () => {
    it('bumps the version and refuses a stale one', async () => {
      const created = await createProject({ name: 'Concurrent' });

      const first = await api.inject({
        method: 'PUT',
        url: `/api/projects/${created.id}`,
        headers: jar.headers(),
        payload: {
          version: created.version,
          document: circuitDocument('Concurrent', HALF_ADDER_BODY)
        }
      });
      expect(first.statusCode).toBe(200);
      expect(first.json().version).toBe(created.version + 1);

      // The other tab still holds the version it opened.
      const second = await api.inject({
        method: 'PUT',
        url: `/api/projects/${created.id}`,
        headers: jar.headers(),
        payload: {
          version: created.version,
          document: circuitDocument('Concurrent', EMPTY_BODY)
        }
      });
      expect(second.statusCode).toBe(409);
      expect(second.json().code).toBe('version_conflict');

      // And the losing write changed nothing.
      const opened = await api.inject({
        method: 'GET',
        url: `/api/projects/${created.id}`,
        headers: jar.headers()
      });
      expect(opened.json().componentCount).toBe(4);
    });

    it('keeps the row´s name whatever the document says', async () => {
      const created = await createProject({ name: 'Stable' });

      const saved = await api.inject({
        method: 'PUT',
        url: `/api/projects/${created.id}`,
        headers: jar.headers(),
        payload: {
          version: created.version,
          document: circuitDocument('renamed behind the row´s back', EMPTY_BODY)
        }
      });

      expect(saved.json().name).toBe('Stable');
    });

    it('answers 404 for somebody else´s project rather than 403', async () => {
      const created = await createProject({ name: 'Private' });

      const response = await api.inject({
        method: 'PUT',
        url: `/api/projects/${created.id}`,
        headers: otherJar.headers(),
        payload: {
          version: created.version,
          document: circuitDocument('Private', EMPTY_BODY)
        }
      });

      // Distinguishing the two would let anyone enumerate which ids exist.
      expect(response.statusCode).toBe(404);
    });
  });

  describe('what a document must survive to be stored', () => {
    it('normalizes a legacy document to the current version', async () => {
      // A v0 document has no `version` field, which is how it is detected:
      // positional elements, a wire as a `p`→`q` segment, and the old plug
      // type ids.
      const legacy = {
        project: {
          name: 'Legacy board',
          elements: [
            { t: 201, p: [15, 10], o: 1 },
            { t: 202, p: [28, 10], i: 1 },
            { t: 2, p: [20, 10], i: 2 },
            { t: 0, p: [16, 10], q: [20, 10] }
          ]
        }
      };

      const created = await createProject({
        name: 'Legacy board',
        document: legacy
      });
      const opened = await api.inject({
        method: 'GET',
        url: `/api/projects/${created.id}`,
        headers: jar.headers()
      });

      // The table only ever holds one version, so a v0 upload is stored as v1.
      expect(opened.json().document.version).toBe(CURRENT_FILE_VERSION);
    });

    it('refuses a version newer than it knows, as its own failure kind', async () => {
      const response = await api.inject({
        method: 'POST',
        url: '/api/projects',
        headers: jar.headers(),
        payload: {
          name: 'From the future',
          document: { ...circuitDocument('From the future'), version: 99 }
        }
      });

      expect(response.statusCode).toBe(422);
      expect(response.json().code).toBe('unsupported_format_version');
    });

    it('refuses an out-of-range option value rather than clamping it', async () => {
      const response = await api.inject({
        method: 'POST',
        url: '/api/projects',
        headers: jar.headers(),
        payload: {
          name: 'Tampered',
          document: circuitDocument('Tampered', {
            components: [
              {
                type: BuiltInComponentType.ROM,
                pos: [0, 0],
                options: { wordSize: 4, addressSize: 9001, data: '' }
              }
            ],
            wires: []
          })
        }
      });

      expect(response.statusCode).toBe(422);
      expect(response.json().code).toBe('invalid_document');
    });

    it('leaves the stored circuit untouched when a save is refused', async () => {
      const created = await createProject({
        name: 'Intact',
        document: circuitDocument('Intact', HALF_ADDER_BODY)
      });

      const refused = await api.inject({
        method: 'PUT',
        url: `/api/projects/${created.id}`,
        headers: jar.headers(),
        payload: {
          version: created.version,
          document: { ...circuitDocument('Intact'), wires: 'not a wire chain' }
        }
      });
      expect(refused.statusCode).toBe(422);

      const opened = await api.inject({
        method: 'GET',
        url: `/api/projects/${created.id}`,
        headers: jar.headers()
      });
      expect(opened.json()).toMatchObject({
        version: created.version,
        componentCount: 4,
        wireCount: 2
      });
    });
  });

  describe('dependency edges', () => {
    const MODEL = CUSTOM_TYPE_ID_BASE;

    it('are extracted from the document, and report the master as it stands', async () => {
      const master = await createComponent({
        name: 'Master',
        symbol: 'MST',
        document: circuitDocument('Master', HALF_ADDER_BODY)
      });

      const board = await createProject({
        name: 'Uses master',
        document: circuitDocument(
          'Uses master',
          { components: [gate(MODEL, 2, 2)], wires: [] },
          [
            serverSnapshot({
              type: MODEL,
              masterId: master.id,
              version: master.version
            })
          ]
        )
      });

      const opened = await api.inject({
        method: 'GET',
        url: `/api/projects/${board.id}`,
        headers: jar.headers()
      });
      expect(opened.json().dependencies).toEqual([
        expect.objectContaining({
          id: master.id,
          model: MODEL,
          name: 'Master',
          symbol: 'MST',
          version: master.version,
          numInputs: 2,
          numOutputs: 1,
          labels: ['A', 'B', 'S']
        })
      ]);
    });

    it('report a master that has moved on, which is the update signal', async () => {
      const master = await createComponent({
        name: 'Moving',
        symbol: 'MOV',
        document: circuitDocument('Moving', HALF_ADDER_BODY)
      });
      const board = await createProject({
        name: 'Tracks master',
        document: circuitDocument(
          'Tracks master',
          { components: [gate(MODEL, 2, 2)], wires: [] },
          [
            serverSnapshot({
              type: MODEL,
              masterId: master.id,
              version: master.version
            })
          ]
        )
      });

      const renamed = await api.inject({
        method: 'PATCH',
        url: `/api/components/${master.id}`,
        headers: jar.headers(),
        payload: { name: 'Moved' }
      });
      expect(renamed.json().version).toBe(master.version + 1);

      const opened = await api.inject({
        method: 'GET',
        url: `/api/projects/${board.id}`,
        headers: jar.headers()
      });
      // The embedded snapshot is behind the live master, which is what the
      // client compares.
      expect(opened.json().dependencies[0]).toMatchObject({
        name: 'Moved',
        version: master.version + 1
      });
    });

    it('are dropped when the master is gone, and the board still opens', async () => {
      const master = await createComponent({
        name: 'Doomed',
        symbol: 'DMD',
        document: circuitDocument('Doomed', HALF_ADDER_BODY)
      });
      const board = await createProject({
        name: 'Survives',
        document: circuitDocument(
          'Survives',
          { components: [gate(MODEL, 2, 2)], wires: [] },
          [
            serverSnapshot({
              type: MODEL,
              masterId: master.id,
              version: master.version
            })
          ]
        )
      });

      const deleted = await api.inject({
        method: 'DELETE',
        url: `/api/components/${master.id}`,
        headers: jar.headers()
      });
      expect(deleted.statusCode).toBe(204);

      const opened = await api.inject({
        method: 'GET',
        url: `/api/projects/${board.id}`,
        headers: jar.headers()
      });
      expect(opened.statusCode).toBe(200);
      expect(opened.json().dependencies).toEqual([]);
      // The document embeds the circuit, so nothing was lost with the master.
      expect(opened.json().componentCount).toBe(1);
    });

    it('skip a master that never existed rather than failing the write', async () => {
      const board = await createProject({
        name: 'Dangling',
        document: circuitDocument(
          'Dangling',
          { components: [gate(MODEL, 2, 2)], wires: [] },
          [
            serverSnapshot({
              type: MODEL,
              masterId: '00000000-0000-4000-8000-000000000000',
              version: 1
            })
          ]
        )
      });

      const rows = await api.db
        .select()
        .from(projectDependencies)
        .where(eq(projectDependencies.dependentId, board.id));
      expect(rows).toEqual([]);
    });

    it('are replaced wholesale by a save, not merged into', async () => {
      const first = await createComponent({
        name: 'First',
        symbol: 'ONE',
        document: circuitDocument('First', HALF_ADDER_BODY)
      });
      const second = await createComponent({
        name: 'Second',
        symbol: 'TWO',
        document: circuitDocument('Second', HALF_ADDER_BODY)
      });

      const board = await createProject({
        name: 'Swaps',
        document: circuitDocument(
          'Swaps',
          { components: [gate(MODEL, 2, 2)], wires: [] },
          [
            serverSnapshot({
              type: MODEL,
              masterId: first.id,
              version: first.version
            })
          ]
        )
      });

      await api.inject({
        method: 'PUT',
        url: `/api/projects/${board.id}`,
        headers: jar.headers(),
        payload: {
          version: board.version,
          document: circuitDocument(
            'Swaps',
            { components: [gate(MODEL, 2, 2)], wires: [] },
            [
              serverSnapshot({
                type: MODEL,
                masterId: second.id,
                version: second.version
              })
            ]
          )
        }
      });

      const opened = await api.inject({
        method: 'GET',
        url: `/api/projects/${board.id}`,
        headers: jar.headers()
      });
      expect(opened.json().dependencies).toHaveLength(1);
      expect(opened.json().dependencies[0].id).toBe(second.id);
    });

    it('refuse a document embedding one master twice', async () => {
      const master = await createComponent({
        name: 'Twice',
        symbol: 'TWC',
        document: circuitDocument('Twice', HALF_ADDER_BODY)
      });

      const response = await api.inject({
        method: 'POST',
        url: '/api/projects',
        headers: jar.headers(),
        payload: {
          name: 'Doubled',
          document: circuitDocument(
            'Doubled',
            {
              components: [gate(MODEL, 2, 2), gate(MODEL + 1, 6, 2)],
              wires: []
            },
            [
              serverSnapshot({
                type: MODEL,
                masterId: master.id,
                version: master.version
              }),
              serverSnapshot({
                type: MODEL + 1,
                masterId: master.id,
                version: master.version
              })
            ]
          )
        }
      });

      // The edge table is keyed by (dependent, dependency), and a document
      // naming one master under two types disagrees with itself.
      expect(response.statusCode).toBe(422);
      expect(response.json().code).toBe('invalid_document');
    });
  });

  describe('fork attribution', () => {
    it('resolves the parent a document claims and answers the chain from its own rows', async () => {
      const original = await createProject({
        name: 'Original',
        document: circuitDocument('Original', HALF_ADDER_BODY)
      });

      const fork = await createProject(
        {
          name: 'Fork',
          document: {
            ...circuitDocument('Fork', HALF_ADDER_BODY),
            attribution: [
              {
                projectId: original.id,
                projectName: 'whatever the client said',
                authorName: 'and whoever it said made it'
              }
            ]
          }
        },
        otherJar
      );

      const opened = await api.inject({
        method: 'GET',
        url: `/api/projects/${fork.id}`,
        headers: otherJar.headers()
      });

      // Names and authors come from this server's rows, so a tampered chain
      // loses attribution rather than forging it.
      expect(opened.json().attribution).toEqual([
        {
          projectId: original.id,
          projectName: 'Original',
          authorName: 'Ada'
        }
      ]);
    });

    it('does not store the chain the client sent', async () => {
      const original = await createProject({ name: 'Root' });
      const fork = await createProject({
        name: 'Derived',
        document: {
          ...circuitDocument('Derived'),
          attribution: [
            {
              projectId: original.id,
              projectName: 'Root',
              authorName: 'Ada'
            }
          ]
        }
      });

      const [row] = await api.db
        .select()
        .from(projects)
        .where(eq(projects.id, fork.id));
      expect(row.document.attribution).toBeUndefined();
      expect(row.forkedFromId).toBe(original.id);
    });

    it('drops a claim naming something that is not here', async () => {
      const created = await createProject({
        name: 'Orphan fork',
        document: {
          ...circuitDocument('Orphan fork'),
          attribution: [
            {
              projectId: '00000000-0000-4000-8000-000000000000',
              projectName: 'Elsewhere',
              authorName: 'Nobody'
            }
          ]
        }
      });

      const opened = await api.inject({
        method: 'GET',
        url: `/api/projects/${created.id}`,
        headers: jar.headers()
      });
      expect(opened.json().attribution).toEqual([]);
    });

    it('walks a chain of forks root-first', async () => {
      const root = await createProject({ name: 'Gen 1' });
      const middle = await createProject({
        name: 'Gen 2',
        document: {
          ...circuitDocument('Gen 2'),
          attribution: [
            { projectId: root.id, projectName: 'x', authorName: 'y' }
          ]
        }
      });
      const leaf = await createProject({
        name: 'Gen 3',
        document: {
          ...circuitDocument('Gen 3'),
          attribution: [
            { projectId: middle.id, projectName: 'x', authorName: 'y' }
          ]
        }
      });

      const opened = await api.inject({
        method: 'GET',
        url: `/api/projects/${leaf.id}`,
        headers: jar.headers()
      });
      expect(
        opened
          .json()
          .attribution.map(
            (entry: { projectName: string }) => entry.projectName
          )
      ).toEqual(['Gen 1', 'Gen 2']);
    });
  });

  describe('metadata', () => {
    it('renames the row and the document´s copy together, and bumps the version', async () => {
      const created = await createProject({ name: 'Before' });

      const patched = await api.inject({
        method: 'PATCH',
        url: `/api/projects/${created.id}`,
        headers: jar.headers(),
        payload: { name: 'After' }
      });
      expect(patched.json()).toMatchObject({
        name: 'After',
        version: created.version + 1
      });

      const opened = await api.inject({
        method: 'GET',
        url: `/api/projects/${created.id}`,
        headers: jar.headers()
      });
      expect(opened.json().document.name).toBe('After');
    });

    it('leaves the version alone for visibility and the share token', async () => {
      const created = await createProject({ name: 'Shared' });

      const patched = await api.inject({
        method: 'PATCH',
        url: `/api/projects/${created.id}`,
        headers: jar.headers(),
        payload: { public: true, regenerateLink: true }
      });

      // The same counter offers placed instances an update, so bumping it here
      // would ask every board to accept a change it cannot see.
      expect(patched.json()).toMatchObject({
        public: true,
        version: created.version
      });
      expect(patched.json().link).not.toBe(created.link);
    });

    it('rejects an update that would change nothing', async () => {
      const created = await createProject({ name: 'Untouched' });

      const response = await api.inject({
        method: 'PATCH',
        url: `/api/projects/${created.id}`,
        headers: jar.headers(),
        payload: {}
      });
      expect(response.statusCode).toBe(422);
    });

    it('answers a body that turns out to ask for nothing', async () => {
      const created = await createProject({ name: 'Kept' });

      // Well-formed and naming no change: the one body that reaches the write
      // path with nothing to set.
      const response = await api.inject({
        method: 'PATCH',
        url: `/api/projects/${created.id}`,
        headers: jar.headers(),
        payload: { regenerateLink: false }
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        name: 'Kept',
        version: created.version,
        link: created.link
      });
    });

    it('renames the circuit that is there when it writes, not the one it read', async () => {
      const created = await createProject({ name: 'Raced' });
      const saved = circuitDocument('Raced', HALF_ADDER_BODY);

      // A save landing between a rename's read and its write loses an edit
      // silently: the rename puts the document it read back, and its version
      // bump lands on the number the save produced.
      const patched = await whileRowLocked(
        api.db,
        (tx) =>
          tx
            .update(projects)
            .set({
              document: sql`${JSON.stringify(saved)}::jsonb`,
              componentCount: 4,
              wireCount: 2,
              version: created.version + 1
            })
            .where(eq(projects.id, created.id)),
        () =>
          api.inject({
            method: 'PATCH',
            url: `/api/projects/${created.id}`,
            headers: jar.headers(),
            payload: { name: 'Renamed' }
          })
      );

      expect(patched.statusCode).toBe(200);
      expect(patched.json()).toMatchObject({
        name: 'Renamed',
        version: created.version + 2
      });

      const opened = await api.inject({
        method: 'GET',
        url: `/api/projects/${created.id}`,
        headers: jar.headers()
      });
      // The circuit the save wrote, with the new name and nothing else changed.
      expect(opened.json().document).toEqual({ ...saved, name: 'Renamed' });
    });

    it('bumps a component´s version for every field a snapshot carries', async () => {
      const created = await createComponent({
        name: 'Snapshotted',
        symbol: 'SNP'
      });

      let version = created.version;
      for (const payload of [
        { name: 'Renamed' },
        { symbol: 'NEW' },
        { description: 'now described' }
      ]) {
        const patched = await api.inject({
          method: 'PATCH',
          url: `/api/components/${created.id}`,
          headers: jar.headers(),
          payload
        });
        expect(patched.json().version).toBe(++version);
      }
    });
  });

  describe('listing', () => {
    it('pages, counts the whole match, and orders by last edit', async () => {
      const cookies = await signUp('lister@example.com', 'Lister');
      for (const name of ['Alpha', 'Beta', 'Gamma']) {
        await createProject({ name }, cookies);
      }

      const first = await api.inject({
        method: 'GET',
        url: '/api/projects?size=2',
        headers: cookies.headers()
      });
      expect(first.json()).toMatchObject({
        page: 0,
        pageSize: 2,
        total: 3
      });
      expect(first.json().entries).toHaveLength(2);
      // Newest edit first, so the last one created leads.
      expect(first.json().entries[0].name).toBe('Gamma');

      const second = await api.inject({
        method: 'GET',
        url: '/api/projects?size=2&page=1',
        headers: cookies.headers()
      });
      expect(
        second.json().entries.map((e: { name: string }) => e.name)
      ).toEqual(['Alpha']);
    });

    it('searches by name without letting a wildcard through', async () => {
      const cookies = await signUp('searcher@example.com', 'Searcher');
      await createProject({ name: 'Adder' }, cookies);
      await createProject({ name: 'Multiplier' }, cookies);

      const found = await api.inject({
        method: 'GET',
        url: '/api/projects?search=add',
        headers: cookies.headers()
      });
      expect(found.json().entries.map((e: { name: string }) => e.name)).toEqual(
        ['Adder']
      );

      // `%` is an ordinary character in what somebody typed, not "everything".
      const wildcard = await api.inject({
        method: 'GET',
        url: '/api/projects?search=%25',
        headers: cookies.headers()
      });
      expect(wildcard.json().entries).toEqual([]);
    });

    it('shows only the caller´s own', async () => {
      const cookies = await signUp('alone@example.com', 'Alone');
      await createProject({ name: 'Mine' }, cookies);

      const response = await api.inject({
        method: 'GET',
        url: '/api/projects',
        headers: cookies.headers()
      });
      expect(response.json().entries).toHaveLength(1);
    });

    it('needs a session', async () => {
      const response = await api.inject({
        method: 'GET',
        url: '/api/projects'
      });
      expect(response.statusCode).toBe(401);
    });

    it('answers 404 for an id that is not one', async () => {
      // Postgres refuses to compare a `uuid` column against something that is
      // not one, so a mistyped URL is turned away before it becomes a 500.
      const response = await api.inject({
        method: 'GET',
        url: '/api/projects/not-a-uuid',
        headers: jar.headers()
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('deleting', () => {
    it('takes the dependency edges with it', async () => {
      const master = await createComponent({
        name: 'Used',
        symbol: 'USD',
        document: circuitDocument('Used', HALF_ADDER_BODY)
      });
      const board = await createProject({
        name: 'Doomed board',
        document: circuitDocument(
          'Doomed board',
          { components: [gate(CUSTOM_TYPE_ID_BASE, 2, 2)], wires: [] },
          [
            serverSnapshot({
              type: CUSTOM_TYPE_ID_BASE,
              masterId: master.id,
              version: master.version
            })
          ]
        )
      });

      await api.inject({
        method: 'DELETE',
        url: `/api/projects/${board.id}`,
        headers: jar.headers()
      });

      const rows = await api.db
        .select()
        .from(projectDependencies)
        .where(eq(projectDependencies.dependentId, board.id));
      expect(rows).toEqual([]);
    });

    it('refuses to delete somebody else´s', async () => {
      const created = await createProject({ name: 'Not yours' });

      const response = await api.inject({
        method: 'DELETE',
        url: `/api/projects/${created.id}`,
        headers: otherJar.headers()
      });
      expect(response.statusCode).toBe(404);

      const stillThere = await api.inject({
        method: 'GET',
        url: `/api/projects/${created.id}`,
        headers: jar.headers()
      });
      expect(stillThere.statusCode).toBe(200);
    });
  });
});
