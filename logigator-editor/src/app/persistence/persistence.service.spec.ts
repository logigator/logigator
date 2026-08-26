/* eslint-disable @typescript-eslint/no-empty-function */

import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firstValueFrom, of } from 'rxjs';
import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { TranslationService } from '../translation/translation.service';
import { PersistenceService } from './persistence.service';
import { AuthRequiredError, ForeignDocumentError } from './persistence-errors';
import { ProjectMetadataStore } from './project-metadata.store';
import { ProjectService } from '../project/project.service';
import { Project } from '../project/project';
import {
  assembleCircuitFile,
  BuiltInComponentType,
  CUSTOM_TYPE_ID_BASE,
  encodeLgix,
  InvalidFileError,
  type FileForkAttributionV1,
  type SerializedCircuitBody,
  type SnapshotDefinition
} from '@logigator/core';
import { environment } from '../../environments/environment';
import { LogLevel } from '../logging/log-level.enum';
import { ToastService } from '../logging/toast.service';
import { ProjectDumpService } from './dump/project-dump.service';
import { ComponentLibraryService } from '../custom-component/component-library.service';
import { PromotionService } from './promotion.service';
import { BrowserProjectStore } from './browser/browser-project.store';
import { BrowserComponentStore } from './browser/browser-component.store';
import { ComponentIdMapStore } from './browser/component-id-map.store';
import { CircuitFileService } from './file/circuit-file.service';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { ComponentProviderService } from '../components/component-provider.service';
import { CustomComponent } from '../components/custom/custom-component';
import { Component } from '../components/component';
import { Wire } from '../wires/wire';
import { Point } from 'pixi.js';
import { MoveComponentsAction } from '../actions/actions/move-components.action';
import {
  FakeBrowserComponentStore,
  FakeBrowserProjectStore,
  FakeComponentIdMapStore
} from '../../testing/fake-browser-stores';
import { configureTestBed } from '../../testing/configure-test-bed';
import { arrayWithExactContents } from '../../testing/vitest-helpers';
import { signal } from '@angular/core';
import type { UserResponse } from '@logigator/contract';
import { makeUser } from '../../testing/user-fixtures';
import { UserService } from '../user/user.service';

/**
 * A stable uuid for a readable label.
 *
 * Every id the API answers with is a uuid — the contract says so and the
 * columns behind it enforce it — and the editor validates what it is handed, so
 * a fixture id like `'test-uuid'` would describe a response the server cannot
 * produce and the read path would rightly refuse it.
 */
function uuid(label: string): string {
  let hash = 0x9e3779b9;
  for (const char of label) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  }
  const hex = hash.toString(16).padStart(8, '0');
  return `${hex}-0000-4000-8000-${hex}0000`;
}

const PROJECT_URL = (id: string) => `${environment.apiUrl}/api/projects/${id}`;
const PROJECTS_LIST_URL = `${environment.apiUrl}/api/projects`;
const COMPONENTS_URL = `${environment.apiUrl}/api/components`;
/** The library listing is paginated, so the preload's URL carries its page. */
const COMPONENTS_PAGE_URL = `${COMPONENTS_URL}?page=0&size=100`;
const COMPONENT_URL = (id: string) =>
  `${environment.apiUrl}/api/components/${id}`;
const SHARE_URL = (link: string) => `${environment.apiUrl}/api/share/${link}`;
const CLONE_URL = (link: string) =>
  `${environment.apiUrl}/api/share/${link}/clone`;

/** The fields every stored circuit answers with, whichever kind it is. */
function circuitFields(o: {
  id: string;
  name: string;
  version?: number;
  public?: boolean;
}) {
  return {
    id: o.id,
    name: o.name,
    description: '',
    public: o.public ?? false,
    link: uuid(`${o.id}-link`),
    version: o.version ?? 1,
    componentCount: 0,
    wireCount: 0,
    preview: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    lastEditedAt: '2024-01-01T00:00:00.000Z'
  };
}

/**
 * A native circuit document, built by the same encoder the editor writes files
 * with — a hand-written fixture gets the wire chain and the position deltas
 * subtly wrong.
 */
function circuitDocument(
  name: string,
  body: SerializedCircuitBody = { components: [], wires: [] },
  definitions: SnapshotDefinition[] = []
) {
  return assembleCircuitFile(body, definitions, name).file;
}

function projectSummaryResponse(
  overrides: Partial<{ id: string; name: string; version: number }> = {}
) {
  return circuitFields({
    id: overrides.id ?? uuid('test-uuid'),
    name: overrides.name ?? 'Test',
    version: overrides.version
  });
}

function projectDetailResponse(
  overrides: Partial<{
    id: string;
    name: string;
    version: number;
    body: SerializedCircuitBody;
    attribution: FileForkAttributionV1[];
  }> = {}
) {
  const name = overrides.name ?? 'Test Project';
  return {
    ...projectSummaryResponse({
      id: overrides.id ?? uuid('test-uuid'),
      name,
      version: overrides.version
    }),
    document: circuitDocument(name, overrides.body),
    dependencies: [],
    attribution: overrides.attribution ?? []
  };
}

function componentSummaryResponse(
  overrides: Partial<{ id: string; name: string; version: number }> = {}
) {
  return {
    ...circuitFields({
      id: overrides.id ?? uuid('srv-comp'),
      name: overrides.name ?? 'Comp',
      version: overrides.version
    }),
    symbol: 'C',
    numInputs: 0,
    numOutputs: 0,
    labels: []
  };
}

function componentDetailResponse(
  overrides: Partial<{
    id: string;
    name: string;
    version: number;
    body: SerializedCircuitBody;
    definitions: SnapshotDefinition[];
  }> = {}
) {
  const name = overrides.name ?? 'Comp';
  return {
    ...componentSummaryResponse({
      id: overrides.id,
      name,
      version: overrides.version
    }),
    document: circuitDocument(name, overrides.body, overrides.definitions),
    dependencies: [],
    attribution: []
  };
}

/** What a share link resolves to — a discriminated union over the two kinds. */
function shareDetailResponse(
  overrides: Partial<{
    id: string;
    name: string;
    type: 'project' | 'comp';
    attribution: FileForkAttributionV1[];
  }> = {}
) {
  const id = overrides.id ?? uuid('share-uuid');
  const name = overrides.name ?? 'Shared';
  const shared = {
    document: circuitDocument(name),
    dependencies: [],
    attribution: overrides.attribution ?? [],
    author: { id: uuid('author-1'), username: 'alice', avatar: null }
  };
  return overrides.type === 'comp'
    ? {
        kind: 'component',
        component: componentSummaryResponse({ id, name }),
        ...shared
      }
    : {
        kind: 'project',
        project: projectSummaryResponse({ id, name }),
        ...shared
      };
}

/** What cloning a share answers: the copy, and the library it brought along. */
function cloneResponse(kind: 'project' | 'comp', id: string) {
  return kind === 'comp'
    ? {
        kind: 'component',
        component: componentSummaryResponse({ id }),
        dependencies: []
      }
    : {
        kind: 'project',
        project: projectSummaryResponse({ id }),
        dependencies: []
      };
}

/** An API failure body, which is what every endpoint answers a failure with. */
function apiError(code: string, message = 'nope') {
  return { code, message };
}

describe('PersistenceService', () => {
  let service: PersistenceService;
  let library: ComponentLibraryService;
  let promotion: PromotionService;
  let metadataStore: ProjectMetadataStore;
  let projectService: ProjectService;
  let httpMock: HttpTestingController;
  let locationGo: Mock;
  let browserStore: FakeBrowserProjectStore;
  let componentStore: FakeBrowserComponentStore;
  let idMapStore: FakeComponentIdMapStore;
  let registry: CustomComponentRegistry;
  let provider: ComponentProviderService;
  // Signed in by default: most tests exercise cloud saves, which the session
  // guard would otherwise reject. Individual tests flip it to null / another
  // user to exercise the guard itself.
  let user: ReturnType<typeof signal<UserResponse | null>>;

  beforeEach(() => {
    // Console output from expected error-path tests is suppressed.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    locationGo = vi.fn();
    browserStore = new FakeBrowserProjectStore();
    componentStore = new FakeBrowserComponentStore();
    idMapStore = new FakeComponentIdMapStore();
    user = signal<UserResponse | null>(makeUser('user-1'));
    configureTestBed([
      { provide: UserService, useValue: { user, sessionExpired: vi.fn() } },
      {
        provide: Location,
        useValue: {
          path: () => '/',
          go: locationGo,
          replaceState: () => undefined,
          subscribe: () => ({ unsubscribe: () => undefined })
        }
      },
      { provide: BrowserProjectStore, useValue: browserStore },
      { provide: BrowserComponentStore, useValue: componentStore },
      { provide: ComponentIdMapStore, useValue: idMapStore },
      {
        provide: TranslationService,
        useValue: {
          translate: vi.fn().mockName('TranslocoService.translate'),
          getActiveLang: () => 'en',
          load: () => of({})
        }
      }
    ]);
    service = TestBed.inject(PersistenceService);
    library = TestBed.inject(ComponentLibraryService);
    promotion = TestBed.inject(PromotionService);
    metadataStore = TestBed.inject(ProjectMetadataStore);
    projectService = TestBed.inject(ProjectService);
    registry = TestBed.inject(CustomComponentRegistry);
    provider = TestBed.inject(ComponentProviderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('createAndSetEmptyProject', () => {
    it('creates an unpersisted browser project, sets as main, and registers metadata', () => {
      const project = service.createAndSetEmptyProject();
      const metadata = metadataStore.getMetadata(project);

      expect(metadata).toBeDefined();
      expect(metadata!.source).toBe('browser');
      expect(metadata!.id).toBe('');
      expect(metadata!.name).toBe('Untitled');
      expect(metadataStore.isDirty(project)).toBe(false);
      expect(projectService.mainProject()).toBe(project);
      // A fresh draft leaves no storage record until the first save.
      expect(browserStore.records.size).toBe(0);
    });
  });

  describe('saveProject', () => {
    it('is a no-op for non-dirty projects (no HTTP call, no storage write)', async () => {
      const project = new Project();
      metadataStore.register(project, {
        id: uuid('test-uuid'),
        name: 'Test',
        type: 'project',
        source: 'server',
        version: 1,
        isPublic: false
      });

      await service.saveProject(project);
      expect(browserStore.records.size).toBe(0);
      // httpMock.verify() in afterEach will fail if a request was made
    });

    it('is a no-op for read-only shares even when dirty', async () => {
      const project = new Project();
      metadataStore.register(
        project,
        {
          id: uuid('share-uuid'),
          name: 'Shared',
          type: 'project',
          source: 'share',
          isPublic: true
        },
        false
      );
      metadataStore.markDirty(project);

      await service.saveProject(project);
      expect(browserStore.records.size).toBe(0);
      expect(metadataStore.isDirty(project)).toBe(true);
    });

    it('writes a dirty browser project to storage and clears dirty', async () => {
      const project = new Project();
      metadataStore.register(project, {
        id: 'browser-1',
        name: 'Local',
        type: 'project',
        source: 'browser',
        isPublic: false
      });
      metadataStore.markDirty(project);

      await service.saveProject(project);

      const record = browserStore.records.get('browser-1');
      expect(record).toBeDefined();
      expect(JSON.parse(record!.content).name).toBe('Local');
      expect(metadataStore.isDirty(project)).toBe(false);
    });

    it('promotes a fresh browser draft: generates an id and updates the URL', async () => {
      const project = service.createAndSetEmptyProject();
      metadataStore.markDirty(project);

      await service.saveProject(project);

      const id = metadataStore.getMetadata(project)!.id;
      expect(id).toBeTruthy();
      expect(browserStore.records.has(id)).toBe(true);
      expect(locationGo).toHaveBeenCalledWith(`/local/${id}`);
      expect(metadataStore.isDirty(project)).toBe(false);
    });

    it('PUTs the document against the read version and adopts the new one', async () => {
      const project = new Project();
      metadataStore.register(project, {
        id: uuid('test-uuid'),
        name: 'Test',
        type: 'project',
        source: 'server',
        version: 4,
        isPublic: false
      });
      metadataStore.markDirty(project);

      const promise = service.saveProject(project);

      const req = httpMock.expectOne(PROJECT_URL(uuid('test-uuid')));
      expect(req.request.method).toBe('PUT');
      // The native document, and the counter the server checks it against.
      expect(req.request.body.version).toBe(4);
      expect(req.request.body.document.version).toBe(1);
      expect(req.request.body.document.name).toBe('Test');
      req.flush(projectSummaryResponse({ version: 5 }));

      await promise;
      expect(metadataStore.getMetadata(project)!.version).toBe(5);
      expect(metadataStore.isDirty(project)).toBe(false);
    });

    it('deduplicates concurrent saves into a single request', async () => {
      const project = new Project();
      metadataStore.register(project, {
        id: uuid('test-uuid'),
        name: 'Test',
        type: 'project',
        source: 'server',
        version: 1,
        isPublic: false
      });
      metadataStore.markDirty(project);

      const promise1 = service.saveProject(project);
      const promise2 = service.saveProject(project);

      // expectOne asserts exactly one request was issued (dedup worked).
      const req = httpMock.expectOne(PROJECT_URL(uuid('test-uuid')));
      req.flush(projectSummaryResponse({ version: 2 }));

      await Promise.all([promise1, promise2]);
      expect(metadataStore.getMetadata(project)!.version).toBe(2);
    });

    it('on version_conflict: rejects, keeps the stale version and stays dirty', async () => {
      const project = new Project();
      metadataStore.register(project, {
        id: uuid('test-uuid'),
        name: 'Test',
        type: 'project',
        source: 'server',
        version: 2,
        isPublic: false
      });
      metadataStore.markDirty(project);

      const promise = service.saveProject(project);

      const req = httpMock.expectOne(PROJECT_URL(uuid('test-uuid')));
      req.flush(apiError('version_conflict', 'Somebody else saved first'), {
        status: 409,
        statusText: 'Conflict'
      });

      await expect(promise).rejects.toThrow();
      // Nothing was merged, so the client keeps what it read and stays dirty.
      expect(metadataStore.getMetadata(project)!.version).toBe(2);
      expect(metadataStore.isDirty(project)).toBe(true);
    });

    it('keeps dirty=true when an edit lands during the save (race protection)', async () => {
      const project = new Project();
      metadataStore.register(project, {
        id: uuid('test-uuid'),
        name: 'Test',
        type: 'project',
        source: 'server',
        version: 1,
        isPublic: false
      });
      metadataStore.markDirty(project);

      const promise = service.saveProject(project);

      // Simulate an edit landing while the save HTTP request is in flight
      metadataStore.markDirty(project);

      const req = httpMock.expectOne(PROJECT_URL(uuid('test-uuid')));
      req.flush(projectSummaryResponse({ version: 2 }));

      await promise;

      // The version advances, but dirty stays true because a concurrent edit
      // fired while we were saving the previous snapshot.
      expect(metadataStore.getMetadata(project)!.version).toBe(2);
      expect(metadataStore.isDirty(project)).toBe(true);
    });
  });

  describe('cloud session guard', () => {
    function registerServerProject(): Project {
      const project = new Project();
      metadataStore.register(project, {
        id: uuid('test-uuid'),
        name: 'Test',
        type: 'project',
        source: 'server',
        version: 1,
        isPublic: false
      });
      metadataStore.markDirty(project);
      return project;
    }

    it('rejects a cloud save while signed out and keeps the project dirty', async () => {
      const project = registerServerProject();
      user.set(null);

      await expect(service.saveProject(project)).rejects.toBeInstanceOf(
        AuthRequiredError
      );
      expect(metadataStore.isDirty(project)).toBe(true);
      // httpMock.verify() in afterEach asserts no PUT went out.
    });

    it('rejects a cloud save of a document owned by a different account', async () => {
      const project = registerServerProject();
      TestBed.tick(); // stamp the document with user-1

      user.set(makeUser('user-2'));
      await expect(service.saveProject(project)).rejects.toBeInstanceOf(
        ForeignDocumentError
      );
      expect(metadataStore.isDirty(project)).toBe(true);
    });

    it('allows saving again when the original owner signs back in', async () => {
      const project = registerServerProject();
      TestBed.tick();
      user.set(null);
      user.set(makeUser('user-1'));

      const promise = service.saveProject(project);
      const req = httpMock.expectOne(PROJECT_URL(uuid('test-uuid')));
      req.flush(projectSummaryResponse());
      await promise;
      expect(metadataStore.isDirty(project)).toBe(false);
    });

    it('rejects creating new cloud records while signed out', async () => {
      user.set(null);
      await expect(
        service.createServerComponent({
          name: 'C',
          symbol: 'C',
          description: ''
        })
      ).rejects.toBeInstanceOf(AuthRequiredError);
      await expect(
        promotion.saveDraftAsServer(new Project(), 'Draft', false)
      ).rejects.toBeInstanceOf(AuthRequiredError);
    });
  });

  describe('clearServerMasters', () => {
    it('removes cloud masters from the registry and palette, keeping snapshots', () => {
      const masterTypeId = registry.createMaster(
        { id: 'cloud-1', name: 'Cloud Gate' },
        'server'
      );
      const snapshot = registry.snapshot(masterTypeId);

      library.clearServerMasters();

      expect(registry.getDefinition(masterTypeId)).toBeUndefined();
      expect(registry.masterTypeIdForId('cloud-1')).toBeUndefined();
      expect(provider.getComponent(masterTypeId)).toBeUndefined();
      // Placed instances wrap snapshots, which must keep resolving.
      expect(registry.getDefinition(snapshot.typeId)).toBeDefined();
      expect(provider.getComponent(snapshot.typeId)).toBeDefined();
    });

    it('keeps a master whose editor tab is open, and leaves browser masters alone', () => {
      const openTypeId = registry.createMaster(
        { id: 'cloud-open', name: 'Open' },
        'server'
      );
      const closedTypeId = registry.createMaster(
        { id: 'cloud-closed', name: 'Closed' },
        'server'
      );
      const browserTypeId = registry.createMaster(
        { id: 'local-1', name: 'Local' },
        'browser'
      );
      const editor = new Project();
      metadataStore.register(editor, {
        id: 'cloud-open',
        name: 'Open',
        type: 'comp',
        source: 'server',
        isPublic: false
      });

      library.clearServerMasters();

      expect(registry.getDefinition(openTypeId)).toBeDefined();
      expect(registry.getDefinition(closedTypeId)).toBeUndefined();
      expect(registry.getDefinition(browserTypeId)).toBeDefined();
    });
  });

  describe('loadProject', () => {
    it('loads project, populates metadata, and starts clean', async () => {
      const body: SerializedCircuitBody = {
        components: [
          { type: BuiltInComponentType.NOT, pos: [5, 3], options: {} }
        ],
        wires: []
      };
      const loadPromise = service.loadProject(uuid('test-uuid'));

      const req = httpMock.expectOne(PROJECT_URL(uuid('test-uuid')));
      expect(req.request.method).toBe('GET');
      req.flush(projectDetailResponse({ body, version: 3 }));

      const project = await loadPromise;
      const metadata = metadataStore.getMetadata(project);
      expect(metadata!.id).toBe(uuid('test-uuid'));
      expect(metadata!.version).toBe(3);
      expect(metadata!.source).toBe('server');
      expect(metadataStore.isDirty(project)).toBe(false);
      expect(Array.from(project.components).length).toBe(1);
    });

    it('captures the detail response fork attribution into metadata', async () => {
      const attribution = [
        {
          projectId: uuid('origin-1'),
          projectName: 'Origin',
          authorName: 'alice'
        }
      ];
      const loadPromise = service.loadProject(uuid('fork-uuid'));

      httpMock
        .expectOne(PROJECT_URL(uuid('fork-uuid')))
        .flush(projectDetailResponse({ id: uuid('fork-uuid'), attribution }));

      const project = await loadPromise;
      expect(metadataStore.getMetadata(project)!.attribution).toEqual(
        attribution
      );
    });

    it("leaves attribution unset for a project that is nobody's fork", async () => {
      // The API spells "no lineage" as an empty array and the file format as an
      // absent field; carrying the empty one would read as a checked-and-absent
      // lineage rather than none, and an export would then claim one.
      const loadPromise = service.loadProject(uuid('plain-uuid'));
      httpMock
        .expectOne(PROJECT_URL(uuid('plain-uuid')))
        .flush(projectDetailResponse({ id: uuid('plain-uuid') }));

      const project = await loadPromise;
      expect(metadataStore.getMetadata(project)!.attribution).toBeUndefined();
    });

    it('rejects when the API returns 404', async () => {
      const loadPromise = service.loadProject('missing');
      const req = httpMock.expectOne(PROJECT_URL('missing'));
      req.flush(apiError('not_found', 'No such project'), {
        status: 404,
        statusText: 'Not Found'
      });
      await expect(loadPromise).rejects.toThrow();
    });
  });

  describe('loadProjectAsMain', () => {
    it('replaces main project and registers it', async () => {
      const promise = service.loadProjectAsMain(uuid('uuid-1'));

      const req = httpMock.expectOne(PROJECT_URL(uuid('uuid-1')));
      req.flush(projectDetailResponse({ id: uuid('uuid-1') }));

      await promise;

      expect(projectService.mainProject()).toBeDefined();
      expect(metadataStore.getMetadata(projectService.mainProject()!)?.id).toBe(
        uuid('uuid-1')
      );
      expect(locationGo).toHaveBeenCalledWith(`/project/${uuid('uuid-1')}`);
    });

    it('skips URL update when skipUrlUpdate=true', async () => {
      const promise = service.loadProjectAsMain(uuid('uuid-1'), {
        skipUrlUpdate: true
      });

      const req = httpMock.expectOne(PROJECT_URL(uuid('uuid-1')));
      req.flush(projectDetailResponse({ id: uuid('uuid-1') }));

      await promise;
      expect(locationGo).not.toHaveBeenCalled();
    });

    it('on 404: does not throw and falls back to an empty placeholder', async () => {
      const promise = service.loadProjectAsMain('missing');

      const req = httpMock.expectOne(PROJECT_URL('missing'));
      req.flush(apiError('not_found', 'No such project'), {
        status: 404,
        statusText: 'Not Found'
      });

      await promise;

      const main = projectService.mainProject();
      expect(main).toBeDefined();
      expect(metadataStore.getMetadata(main!)?.source).toBe('browser');
      expect(locationGo).toHaveBeenCalledWith('/');
    });

    it('stale loads are discarded with full cleanup (no metadata leak)', async () => {
      // Start load A
      const promiseA = service.loadProjectAsMain(uuid('uuid-a'));

      // Before A resolves, start load B — bumps the token
      const promiseB = service.loadProjectAsMain(uuid('uuid-b'));

      // Resolve B first
      httpMock
        .expectOne(PROJECT_URL(uuid('uuid-b')))
        .flush(projectDetailResponse({ id: uuid('uuid-b') }));

      // Now resolve A — this is stale; the project must be disposed and
      // its metadata removed from the store.
      httpMock
        .expectOne(PROJECT_URL(uuid('uuid-a')))
        .flush(projectDetailResponse({ id: uuid('uuid-a') }));

      await Promise.all([promiseA, promiseB]);

      // Only B's project should be in the metadata store
      const handle = metadataStore.getHandleById(uuid('uuid-a'));
      expect(handle).toBeUndefined();
      expect(metadataStore.getHandleById(uuid('uuid-b'))).toBeDefined();
      expect(projectService.mainProject()).toBe(
        metadataStore.getHandleById(uuid('uuid-b'))!.project
      );
    });
  });

  describe('loadShare / loadShareAsMain', () => {
    it('loadShare returns a non-dirty-tracked project with source=share', async () => {
      const promise = service.loadShare('link-1');

      const req = httpMock.expectOne(SHARE_URL('link-1'));
      req.flush(shareDetailResponse({ id: uuid('share-1') }));

      const { project, type } = await promise;
      expect(type).toBe('project');
      const metadata = metadataStore.getMetadata(project)!;
      expect(metadata.source).toBe('share');
      // The fetched-by link is recorded even though the response has none —
      // the clone action needs it.
      expect(metadata.link).toBe('link-1');
      expect(metadataStore.isDirty(project)).toBe(false);
    });

    it('loadShare captures the share fork attribution into metadata', async () => {
      const attribution = [
        {
          projectId: uuid('origin-1'),
          projectName: 'Origin',
          authorName: 'alice'
        }
      ];
      const promise = service.loadShare('link-fork');

      httpMock
        .expectOne(SHARE_URL('link-fork'))
        .flush(shareDetailResponse({ id: uuid('share-1'), attribution }));

      const { project } = await promise;
      expect(metadataStore.getMetadata(project)!.attribution).toEqual(
        attribution
      );
    });

    it('loadShareAsMain swaps main project for project-type shares', async () => {
      const promise = service.loadShareAsMain('link-1');

      httpMock
        .expectOne(SHARE_URL('link-1'))
        .flush(shareDetailResponse({ id: uuid('share-1'), type: 'project' }));

      await promise;

      const main = projectService.mainProject();
      expect(metadataStore.getMetadata(main!)?.source).toBe('share');
    });

    it('loadShareAsMain fills the main slot for component-type shares', async () => {
      // A `/share/:linkId` page load creates no blank draft (the route
      // matched), so a component share opened as a *tab* would leave the main
      // slot empty: no name and no share chip in the title bar, its tab
      // closable into an editor with no project, and nothing for the clone
      // action to read.
      const promise = service.loadShareAsMain('link-comp');

      httpMock
        .expectOne(SHARE_URL('link-comp'))
        .flush(shareDetailResponse({ id: uuid('comp-1'), type: 'comp' }));

      await promise;

      const main = projectService.mainProject();
      expect(metadataStore.getMetadata(main!)).toEqual(
        expect.objectContaining({
          id: uuid('comp-1'),
          type: 'comp',
          source: 'share'
        })
      );
      expect(projectService.openComponents()).toEqual([]);
    });
  });

  describe('saveDraftAsLocal', () => {
    it('applies the chosen name, persists to storage, assigns an id and updates the URL', async () => {
      const project = service.createAndSetEmptyProject();
      // A pristine, never-edited draft is not dirty — the first save must
      // persist it anyway (the saveProject dirty-guard is bypassed).
      expect(metadataStore.isDirty(project)).toBe(false);

      await service.saveDraftAsLocal(project, 'My Local Circuit');

      const metadata = metadataStore.getMetadata(project)!;
      expect(metadata.name).toBe('My Local Circuit');
      expect(metadata.id).toBeTruthy();
      const record = browserStore.records.get(metadata.id);
      expect(record).toBeDefined();
      expect(JSON.parse(record!.content).name).toBe('My Local Circuit');
      expect(locationGo).toHaveBeenCalledWith(`/local/${metadata.id}`);
    });
  });

  describe('saveDraftAsServer', () => {
    it('creates the server project with its circuit in one POST, flips metadata in place and navigates', async () => {
      const project = service.createAndSetEmptyProject();

      const promise = promotion.saveDraftAsServer(
        project,
        'My Server Circuit',
        true
      );

      // One round trip: a create carries the document, where the legacy API
      // needed a create and then a save into it.
      const postReq = httpMock.expectOne(PROJECTS_LIST_URL);
      expect(postReq.request.method).toBe('POST');
      expect(postReq.request.body.name).toBe('My Server Circuit');
      expect(postReq.request.body.public).toBe(true);
      expect(postReq.request.body.document.version).toBe(1);
      postReq.flush({
        ...projectSummaryResponse({ id: uuid('srv-uuid'), version: 1 }),
        public: true
      });

      await promise;

      const metadata = metadataStore.getMetadata(project)!;
      expect(metadata.source).toBe('server');
      expect(metadata.id).toBe(uuid('srv-uuid'));
      expect(metadata.name).toBe('My Server Circuit');
      expect(metadata.isPublic).toBe(true);
      expect(metadata.version).toBe(1);
      expect(locationGo).toHaveBeenCalledWith(`/project/${uuid('srv-uuid')}`);
      // The live project instance is retained — its circuit and undo history
      // are preserved across promotion (not replaced by a fresh empty one).
      expect(projectService.mainProject()).toBe(project);
      // No storage record is written for a server promotion.
      expect(browserStore.records.size).toBe(0);
    });
  });

  describe('promoteProjectToServer', () => {
    it('uploads the live project, flips metadata, navigates and deletes the browser record', async () => {
      const project = new Project();
      metadataStore.register(project, {
        id: 'browser-1',
        name: 'Local',
        type: 'project',
        source: 'browser',
        isPublic: false
      });
      metadataStore.markDirty(project);
      await service.saveProject(project);
      expect(browserStore.records.has('browser-1')).toBe(true);

      const promise = promotion.promoteProjectToServer(project, true);

      const postReq = httpMock.expectOne(PROJECTS_LIST_URL);
      expect(postReq.request.method).toBe('POST');
      expect(postReq.request.body.name).toBe('Local');
      expect(postReq.request.body.public).toBe(true);
      postReq.flush({
        ...projectSummaryResponse({ id: uuid('srv-uuid') }),
        public: true
      });

      await promise;

      const metadata = metadataStore.getMetadata(project)!;
      expect(metadata.source).toBe('server');
      expect(metadata.id).toBe(uuid('srv-uuid'));
      expect(metadata.isPublic).toBe(true);
      expect(locationGo).toHaveBeenCalledWith(`/project/${uuid('srv-uuid')}`);
      // Moved, not copied: the old browser record is gone.
      expect(browserStore.records.has('browser-1')).toBe(false);
    });

    it('rejects a fresh draft (no stored id) without any HTTP call', async () => {
      const project = service.createAndSetEmptyProject();
      await expect(
        promotion.promoteProjectToServer(project, false)
      ).rejects.toThrow();
    });

    it('carries the lineage inside the uploaded document, so the server can re-link the fork', async () => {
      const project = new Project();
      metadataStore.register(project, {
        id: 'browser-1',
        name: 'Fork',
        type: 'project',
        source: 'browser',
        isPublic: false,
        attribution: [
          { projectId: 'root-id', projectName: 'Root', authorName: 'alice' },
          { projectId: 'parent-id', projectName: 'Parent', authorName: 'bob' }
        ]
      });
      metadataStore.markDirty(project);
      await service.saveProject(project);

      const promise = promotion.promoteProjectToServer(project, false);

      const postReq = httpMock.expectOne(PROJECTS_LIST_URL);
      // There is no request field for the fork parent: the claim travels inside
      // the document, and the server reads the chain's last entry — the
      // immediate parent, since the chain is root-first — and checks it against
      // its own rows before it becomes a link.
      expect(postReq.request.body.document.attribution).toEqual([
        { projectId: 'root-id', projectName: 'Root', authorName: 'alice' },
        { projectId: 'parent-id', projectName: 'Parent', authorName: 'bob' }
      ]);
      postReq.flush(projectSummaryResponse({ id: uuid('srv-uuid') }));

      await promise;
    });
  });

  describe('uploadStoredProjectToServer', () => {
    it('delegates to the live path when the id is the open project', async () => {
      const project = new Project();
      metadataStore.register(project, {
        id: 'browser-1',
        name: 'Local',
        type: 'project',
        source: 'browser',
        isPublic: false
      });
      metadataStore.markDirty(project);
      await service.saveProject(project);
      projectService.setMainProject(project);

      const promise = promotion.uploadStoredProjectToServer('browser-1', false);

      const postReq = httpMock.expectOne(PROJECTS_LIST_URL);
      expect(postReq.request.body.name).toBe('Local');
      expect(postReq.request.body.public).toBe(false);
      postReq.flush(projectSummaryResponse({ id: uuid('srv-uuid') }));

      await promise;

      expect(metadataStore.getMetadata(project)!.source).toBe('server');
      expect(browserStore.records.has('browser-1')).toBe(false);
    });

    it('uploads a stored record via a throwaway project and deletes it, leaving the open project untouched', async () => {
      // A stored local project that is NOT the open one.
      const stored = new Project();
      metadataStore.register(stored, {
        id: 'stored-1',
        name: 'Archived',
        type: 'project',
        source: 'browser',
        isPublic: false
      });
      metadataStore.markDirty(stored);
      await service.saveProject(stored);
      expect(browserStore.records.has('stored-1')).toBe(true);

      // The open project is a different, fresh draft.
      const main = service.createAndSetEmptyProject();

      const promise = promotion.uploadStoredProjectToServer('stored-1', true);

      // The temp path reads the stored record (an await) before issuing the POST,
      // so let that microtask settle before asserting the request.
      await Promise.resolve();
      const postReq = httpMock.expectOne(PROJECTS_LIST_URL);
      expect(postReq.request.body.name).toBe('Archived');
      expect(postReq.request.body.public).toBe(true);
      postReq.flush(projectSummaryResponse({ id: uuid('srv-uuid') }));

      await promise;

      // The stored record moved to the cloud; the open project is unchanged.
      expect(browserStore.records.has('stored-1')).toBe(false);
      expect(projectService.mainProject()).toBe(main);
      expect(metadataStore.getMetadata(main)!.source).toBe('browser');
    });
  });

  describe('createProject', () => {
    it('POSTs an empty board, sets it as main and updates the URL', async () => {
      const promise = service.createProject('My Project', undefined, false);

      // No document: a create without one is an empty board server-side, which
      // is exactly what the editor is about to show.
      const postReq = httpMock.expectOne(PROJECTS_LIST_URL);
      expect(postReq.request.method).toBe('POST');
      expect(postReq.request.body).toEqual({
        name: 'My Project',
        description: undefined,
        public: false
      });
      postReq.flush(
        projectSummaryResponse({ id: uuid('new-uuid'), version: 1 })
      );

      const created = await promise;
      expect(created).toBe(uuid('new-uuid'));
      expect(projectService.mainProject()).toBeDefined();
      expect(
        metadataStore.getMetadata(projectService.mainProject()!)!.version
      ).toBe(1);
      expect(locationGo).toHaveBeenCalledWith(`/project/${uuid('new-uuid')}`);
    });

    it('sends public:true when isPublic=true', async () => {
      const promise = service.createProject('Pub', undefined, true);

      const postReq = httpMock.expectOne(PROJECTS_LIST_URL);
      expect(postReq.request.body.public).toBe(true);
      postReq.flush(projectSummaryResponse({ id: uuid('pub-uuid') }));

      await promise;
    });
  });

  describe('cloneShare', () => {
    it('rejects with AuthRequiredError when the clone needs a session', async () => {
      // Reading a share needs none — the link is the capability — but cloning
      // writes into an account, so the API is what says so. Nothing is asked in
      // advance.
      const promise = service.cloneShare('link-1');

      httpMock
        .expectOne(CLONE_URL('link-1'))
        .flush(apiError('unauthorized', 'Not signed in'), {
          status: 401,
          statusText: 'Unauthorized'
        });

      await expect(promise).rejects.toEqual(expect.any(AuthRequiredError));
    });

    it('clones, loads, sets as main, and updates URL', async () => {
      const promise = service.cloneShare('link-1');

      const clone = httpMock.expectOne(CLONE_URL('link-1'));
      expect(clone.request.method).toBe('POST');
      clone.flush(cloneResponse('project', uuid('cloned-uuid')));
      // cloneShare awaits the gateway clone, then loadProjectAsMain — two
      // async hops to drain before the project GET is issued.
      await Promise.resolve();
      await Promise.resolve();

      httpMock
        .expectOne(PROJECT_URL(uuid('cloned-uuid')))
        .flush(projectDetailResponse({ id: uuid('cloned-uuid') }));

      await promise;
      expect(projectService.mainProject()).toBeDefined();
      expect(metadataStore.getMetadata(projectService.mainProject()!)!.id).toBe(
        uuid('cloned-uuid')
      );
      expect(locationGo).toHaveBeenCalledWith(
        `/project/${uuid('cloned-uuid')}`
      );
    });

    it('reopens a cloned component share as a component', async () => {
      // One clone endpoint serves both kinds — the link already says what it
      // points at — but the copy still has to reopen as a component, so that it
      // carries its DefinitionBinding and lands in the component library.
      const tick = () => new Promise((r) => setTimeout(r, 0));
      const promise = service.cloneShare('link-c');

      httpMock
        .expectOne(CLONE_URL('link-c'))
        .flush(cloneResponse('comp', uuid('cloned-comp')));
      await tick();

      httpMock
        .expectOne(COMPONENT_URL(uuid('cloned-comp')))
        .flush(componentDetailResponse({ id: uuid('cloned-comp') }));

      await promise;
      expect(metadataStore.getMetadata(projectService.mainProject()!)).toEqual(
        expect.objectContaining({
          id: uuid('cloned-comp'),
          type: 'comp',
          source: 'server'
        })
      );
      expect(locationGo).toHaveBeenCalledWith(
        `/component/${uuid('cloned-comp')}`
      );
    });
  });

  describe('deserialization tolerance', () => {
    it('loadProject silently skips unknown component types', async () => {
      const body: SerializedCircuitBody = {
        components: [
          { type: BuiltInComponentType.NOT, pos: [0, 0], options: {} },
          { type: 999, pos: [5, 5], options: {} }, // no such component
          { type: BuiltInComponentType.NOT, pos: [10, 0], options: {} }
        ],
        wires: []
      };
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // Tests run at Silent verbosity; raise it so the migration's warning is
      // actually emitted for this assertion.
      const originalVerbosity = environment.loggingVerbosity;
      environment.loggingVerbosity = LogLevel.Warn;

      try {
        const promise = service.loadProject(uuid('test-uuid'));
        httpMock
          .expectOne(PROJECT_URL(uuid('test-uuid')))
          .flush(projectDetailResponse({ body }));

        const project = await promise;
        expect(Array.from(project.components).length).toBe(2);
        // The instance builder drops an element whose type resolves to no
        // config, with a warning. LoggingService.warn forwards to
        // console.warn('%c[%s]', style, context, message).
        expect(warnSpy).toHaveBeenCalledWith(
          '%c[%s]',
          'color:#888',
          'circuit-builder',
          expect.stringContaining('Dropped element with unresolved type 999')
        );
      } finally {
        environment.loggingVerbosity = originalVerbosity;
      }
    });
  });

  describe('file import / export', () => {
    it('exportProjectToJson emits the current version and metadata name (source-agnostic)', () => {
      const project = new Project();
      metadataStore.register(project, {
        id: 'server-uuid',
        name: 'My Circuit',
        type: 'project',
        source: 'server',
        isPublic: false
      });

      const parsed = JSON.parse(service.exportProjectToJson(project));
      expect(parsed.version).toBe(1);
      expect(parsed.name).toBe('My Circuit');
      expect(parsed.components).toEqual([]);
      expect(parsed.wires).toBe('');
      expect(parsed.definitions).toEqual([]);
    });

    it('importProjectFromJson persists a clean browser project and navigates to /local/:id', async () => {
      const content = JSON.stringify({
        version: 1,
        name: 'Imported',
        components: [{ type: 1, pos: [2, 3], options: {} }],
        wires: '',
        definitions: []
      });

      const project = await service.importProjectFromJson(content);
      const metadata = metadataStore.getMetadata(project);

      expect(projectService.mainProject()).toBe(project);
      expect(metadata!.source).toBe('browser');
      expect(metadata!.id).toBeTruthy();
      expect(metadata!.name).toBe('Imported');
      expect(metadataStore.isDirty(project)).toBe(false);
      expect(Array.from(project.components).length).toBe(1);

      // Persisted immediately, and the URL reflects the new id.
      expect(browserStore.records.has(metadata!.id)).toBe(true);
      expect(locationGo).toHaveBeenCalledWith(`/local/${metadata!.id}`);
    });

    it('carries fork attribution through export → import → stored blob', async () => {
      const lineage = [
        {
          projectId: uuid('origin-1'),
          projectName: 'Origin',
          authorName: 'alice'
        }
      ];
      const fork = new Project();
      metadataStore.register(fork, {
        id: 'server-uuid',
        name: 'My Fork',
        type: 'project',
        source: 'server',
        isPublic: false,
        attribution: lineage
      });

      const exported = service.exportProjectToJson(fork);
      expect(JSON.parse(exported).attribution).toEqual(lineage);

      const imported = await service.importProjectFromJson(exported);
      const metadata = metadataStore.getMetadata(imported)!;
      expect(metadata.attribution).toEqual(lineage);
      // The stored blob keeps the lineage so later loads/uploads still carry it.
      const record = browserStore.records.get(metadata.id)!;
      expect(JSON.parse(record.content).attribution).toEqual(lineage);
    });

    it('importProjectFromJson rejects on an unreadable file (and stores nothing)', async () => {
      await expect(
        service.importProjectFromJson('{not json')
      ).rejects.toThrowError(InvalidFileError);
      expect(browserStore.records.size).toBe(0);
    });

    it('importProjectFromJson warns the user once when customs are skipped', async () => {
      const toast = TestBed.inject(ToastService);
      const warnSpy = vi.spyOn(toast, 'warn').mockImplementation(() => {});
      // A custom-range element with no embedded definition — its snapshot is
      // missing, so the element drops and the skip must surface as one toast.
      const content = JSON.stringify({
        version: 1,
        name: 'Partial',
        components: [
          { type: CUSTOM_TYPE_ID_BASE, pos: [0, 0], options: {} },
          { type: 1, pos: [2, 3], options: {} }
        ],
        wires: '',
        definitions: []
      });

      const project = await service.importProjectFromJson(content);

      expect(Array.from(project.components).length).toBe(1);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('refuses to export a borrowed share to a file', async () => {
      const project = new Project();
      metadataStore.register(
        project,
        {
          id: 'shared-uuid',
          name: 'Borrowed',
          type: 'project',
          source: 'share',
          isPublic: false
        },
        false
      );

      await expect(service.exportProjectToFile(project)).rejects.toThrow();
    });

    it('importProjectFromFile reads a gzipped .lgix container', async () => {
      const json = JSON.stringify({
        version: 1,
        name: 'Zipped',
        components: [{ type: 1, pos: [2, 3], options: {} }],
        wires: '',
        definitions: []
      });
      const bytes = await encodeLgix(json);

      const project = await service.importProjectFromFile(bytes.buffer);
      const metadata = metadataStore.getMetadata(project);

      expect(metadata!.name).toBe('Zipped');
      expect(metadata!.source).toBe('browser');
      expect(Array.from(project.components).length).toBe(1);
      expect(browserStore.records.has(metadata!.id)).toBe(true);
    });

    it('importProjectFromFile falls back to plain JSON without the magic bytes', async () => {
      const json = JSON.stringify({
        version: 1,
        name: 'Plain',
        components: [],
        wires: '',
        definitions: []
      });
      const data = new TextEncoder().encode(json).buffer;

      const project = await service.importProjectFromFile(data);

      expect(metadataStore.getMetadata(project)!.name).toBe('Plain');
    });
  });

  describe('Project Dump', () => {
    let dumpService: ProjectDumpService;

    beforeEach(() => {
      dumpService = TestBed.inject(ProjectDumpService);
    });

    it('round-trips element ids and the undo history', async () => {
      const source = await service.importProjectFromJson(
        JSON.stringify({
          version: 1,
          name: 'Dumpee',
          components: [
            { type: 1, pos: [2, 3], options: {} },
            { type: 1, pos: [5, 6], options: {} }
          ],
          wires: '0,0:e4',
          definitions: []
        })
      );

      // Push a real action so the history is non-empty and the body reflects it.
      const movedId = Array.from(source.components)[0].id;
      source.actionManager.push(
        new MoveComponentsAction({
          id: movedId,
          oldPos: new Point(2, 3),
          newPos: new Point(9, 9)
        })
      );
      const sourceComponentIds = Array.from(source.components).map((c) => c.id);
      const sourceWireIds = Array.from(source.wires).map((w) => w.id);

      const dumpJson = JSON.stringify(dumpService.buildDump(source));
      const restored = await dumpService.importDump(dumpJson);

      // Ids re-stamped exactly (the native format drops them on load); the
      // encoders reorder elements, so compare as sets — the geometry-level
      // mapping is covered by the dedicated reorder test below.
      expect(Array.from(restored.components).map((c) => c.id)).toEqual(
        arrayWithExactContents(sourceComponentIds)
      );
      expect(Array.from(restored.wires).map((w) => w.id)).toEqual(
        arrayWithExactContents(sourceWireIds)
      );

      // History + pointer restored without re-applying.
      expect(restored.actionManager.history.length).toBe(1);
      expect(restored.actionManager.pointer).toBe(1);

      // The restored action targets the re-stamped element: the body shows the
      // moved position, and undo reverts it.
      const moved = restored.getComponentById(movedId)!;
      expect([moved.position.x, moved.position.y]).toEqual([9, 9]);
      restored.actionManager.undo();
      expect([moved.position.x, moved.position.y]).toEqual([2, 3]);
    });

    it('re-stamps element ids by geometry when the encoders reorder', async () => {
      // Both fixtures decode to an insertion order that differs from the
      // encoders' emission order: the wire at (10,10) precedes the touching
      // run at (0,0) that the sorted walk emits first, and the component at
      // (5,6) precedes the one at (2,3) that the (type, y, x) sort emits
      // first.
      const source = await service.importProjectFromJson(
        JSON.stringify({
          version: 1,
          name: 'Dumpee',
          components: [
            { type: 1, pos: [5, 6], options: {} },
            { type: 1, pos: [-3, -3], options: {} }
          ],
          wires: '10,10:e4;-10,-10:e4s3',
          definitions: []
        })
      );
      const wireGeometry = (w: Wire) =>
        `${Math.floor(w.position.x)},${Math.floor(w.position.y)},${w.direction},${w.length}`;
      const compGeometry = (c: Component) => `${c.position.x},${c.position.y}`;
      const sourceWireIds = new Map(
        Array.from(source.wires).map((w) => [wireGeometry(w), w.id])
      );
      const sourceComponentIds = new Map(
        Array.from(source.components).map((c) => [compGeometry(c), c.id])
      );

      const restored = await dumpService.importDump(
        JSON.stringify(dumpService.buildDump(source))
      );

      const restoredWires = Array.from(restored.wires);
      const restoredComponents = Array.from(restored.components);
      expect(restoredWires).toHaveLength(3);
      expect(restoredComponents).toHaveLength(2);
      // The dump did reorder relative to the source project…
      expect(restoredWires.map((w) => w.id)).not.toEqual(
        Array.from(source.wires).map((w) => w.id)
      );
      expect(restoredComponents.map((c) => c.id)).not.toEqual(
        Array.from(source.components).map((c) => c.id)
      );
      // …but every element still carries its original id.
      for (const w of restoredWires) {
        expect(w.id).toBe(sourceWireIds.get(wireGeometry(w)));
      }
      for (const c of restoredComponents) {
        expect(c.id).toBe(sourceComponentIds.get(compGeometry(c)));
      }
    });

    it('skips id/history restore when the element count changed', async () => {
      const source = await service.importProjectFromJson(
        JSON.stringify({
          version: 1,
          name: 'Dumpee',
          components: [{ type: 1, pos: [2, 3], options: {} }],
          wires: '',
          definitions: []
        })
      );
      source.actionManager.push(
        new MoveComponentsAction({
          id: Array.from(source.components)[0].id,
          oldPos: new Point(2, 3),
          newPos: new Point(9, 9)
        })
      );

      // Tamper with the saved id list so it no longer lines up with the body.
      const dump = dumpService.buildDump(source);
      dump.componentIds = [...dump.componentIds, 999];
      const restored = await dumpService.importDump(JSON.stringify(dump));

      expect(Array.from(restored.components).length).toBe(1);
      expect(restored.actionManager.history.length).toBe(0);
    });
  });

  describe('browser projects', () => {
    it('loadLocalProject reads a stored circuit and registers it as a browser project', async () => {
      // Seed a record using the same encoding the service writes.
      const imported = await service.importProjectFromJson(
        JSON.stringify({
          version: 1,
          name: 'Seed',
          components: [{ type: 1, pos: [4, 4], options: {} }],
          wires: '',
          definitions: []
        })
      );
      const id = metadataStore.getMetadata(imported)!.id;

      const project = await service.loadLocalProject(id);
      const metadata = metadataStore.getMetadata(project);

      expect(metadata!.source).toBe('browser');
      expect(metadata!.id).toBe(id);
      expect(metadata!.name).toBe('Seed');
      expect(Array.from(project.components).length).toBe(1);
    });

    it('loadLocalProject rejects when no record exists', async () => {
      await expect(service.loadLocalProject('nope')).rejects.toThrow();
    });

    it('loadLocalProjectAsMain sets the project as main and updates the URL', async () => {
      const record = await browserStore.save({
        name: 'Stored',
        content: JSON.stringify({
          version: 1,
          name: 'Stored',
          components: [],
          wires: '',
          definitions: []
        })
      });

      await service.loadLocalProjectAsMain(record.id);

      const main = projectService.mainProject();
      expect(main).toBeDefined();
      expect(metadataStore.getMetadata(main!)!.id).toBe(record.id);
      expect(locationGo).toHaveBeenCalledWith(`/local/${record.id}`);
    });

    it('listBrowserProjects returns stored summaries', async () => {
      await browserStore.save({ name: 'One', content: '{}' });
      await browserStore.save({ name: 'Two', content: '{}' });

      const list = await service.listBrowserProjects();
      expect(list.map((p) => p.name).sort()).toEqual(['One', 'Two']);
    });

    it('renameBrowserProject rewrites both the summary column and the blob name', async () => {
      const record = await browserStore.save({
        name: 'Old',
        content: JSON.stringify({
          version: 1,
          name: 'Old',
          components: [],
          wires: '',
          definitions: []
        })
      });

      await service.renameBrowserProject(record.id, 'New');

      const stored = browserStore.records.get(record.id)!;
      expect(stored.name).toBe('New');
      const parsed = JSON.parse(stored.content);
      expect(parsed.name).toBe('New');
      // The rest of the blob is preserved.
      expect(parsed.version).toBe(1);

      // Reopening reflects the new name — the codec reads the blob, not the column.
      const reopened = await service.loadLocalProject(record.id);
      expect(metadataStore.getMetadata(reopened)!.name).toBe('New');
    });

    it('renameBrowserProject syncs the metadata of an already-open project', async () => {
      const record = await browserStore.save({
        name: 'Open',
        content: JSON.stringify({
          version: 1,
          name: 'Open',
          components: [],
          wires: '',
          definitions: []
        })
      });
      await service.loadLocalProjectAsMain(record.id);
      const project = projectService.mainProject()!;
      expect(metadataStore.getMetadata(project)!.name).toBe('Open');

      await service.renameBrowserProject(record.id, 'Renamed');

      expect(metadataStore.getMetadata(project)!.name).toBe('Renamed');
    });

    it('renameBrowserProject rejects when no record exists', async () => {
      await expect(service.renameBrowserProject('nope', 'x')).rejects.toThrow();
    });
  });

  describe('renameProject (server)', () => {
    it('PATCHes the new name and syncs an open project', async () => {
      const project = new Project();
      metadataStore.register(project, {
        id: uuid('srv-1'),
        name: 'Before',
        type: 'project',
        source: 'server',
        version: 2,
        isPublic: false
      });

      const promise = firstValueFrom(
        service.renameProject(uuid('srv-1'), 'After')
      );

      const req = httpMock.expectOne(PROJECT_URL(uuid('srv-1')));
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ name: 'After' });
      req.flush(
        projectSummaryResponse({ id: uuid('srv-1'), name: 'After', version: 3 })
      );

      await promise;
      const metadata = metadataStore.getMetadata(project)!;
      expect(metadata.name).toBe('After');
      // A rename is content the server stamps, so it bumps the counter; without
      // adopting it here the next save would present a version that has moved.
      expect(metadata.version).toBe(3);
    });
  });

  describe('renameOpenProject', () => {
    it('PATCHes a server project', async () => {
      const project = new Project();
      metadataStore.register(project, {
        id: uuid('srv-1'),
        name: 'Before',
        type: 'project',
        source: 'server',
        version: 2,
        isPublic: false
      });

      const promise = service.renameOpenProject(project, 'After');

      const req = httpMock.expectOne(PROJECT_URL(uuid('srv-1')));
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ name: 'After' });
      req.flush(projectSummaryResponse({ id: uuid('srv-1'), name: 'After' }));

      await promise;
      expect(metadataStore.getMetadata(project)!.name).toBe('After');
    });

    it('rewrites the stored blob of a saved browser project', async () => {
      const record = await browserStore.save({
        name: 'Old',
        content: JSON.stringify({
          version: 1,
          name: 'Old',
          components: [],
          wires: '',
          definitions: []
        })
      });
      const project = await service.loadLocalProject(record.id);

      await service.renameOpenProject(project, 'New');

      expect(
        JSON.parse(browserStore.records.get(record.id)!.content).name
      ).toBe('New');
      expect(metadataStore.getMetadata(project)!.name).toBe('New');
    });

    it('updates only in-memory metadata for a never-saved draft', async () => {
      const project = new Project();
      metadataStore.register(project, {
        id: '',
        name: 'Untitled',
        type: 'project',
        source: 'browser',
        isPublic: false
      });

      await service.renameOpenProject(project, 'Draft name');

      expect(metadataStore.getMetadata(project)!.name).toBe('Draft name');
      // Nothing was written to the browser store — a draft has no record yet.
      expect(browserStore.records.size).toBe(0);
    });

    it('is a no-op for read-only shares', async () => {
      const project = new Project();
      metadataStore.register(project, {
        id: 'shr-1',
        name: 'Shared',
        type: 'project',
        source: 'share',
        isPublic: false
      });

      await service.renameOpenProject(project, 'Nope');

      expect(metadataStore.getMetadata(project)!.name).toBe('Shared');
      httpMock.verify();
    });

    it('is a no-op for component editors', async () => {
      const project = new Project();
      metadataStore.register(project, {
        id: 'cmp-1',
        name: 'Gate',
        type: 'comp',
        source: 'server',
        isPublic: false
      });

      await service.renameOpenProject(project, 'Nope');

      expect(metadataStore.getMetadata(project)!.name).toBe('Gate');
      httpMock.verify();
    });
  });

  describe('custom component persistence (browser)', () => {
    const plugCircuit: SerializedCircuitBody = {
      components: [
        {
          type: 100,
          pos: [0, 0],
          options: { label: 'in', index: 0 }
        },
        {
          type: 101,
          pos: [5, 0],
          options: { label: 'out', index: 0 }
        }
      ],
      wires: []
    };

    function registerBrowserProject(): Project {
      const project = new Project();
      metadataStore.register(project, {
        id: '',
        name: 'Host',
        type: 'project',
        source: 'browser',
        isPublic: false
      });
      return project;
    }

    // Mirror the placement session: snapshot the master, place an instance.
    function placeSnapshot(
      project: Project,
      masterTypeId: number
    ): CustomComponent {
      const def = registry.snapshot(masterTypeId);
      const config = provider.getComponent(def.typeId)!;
      const instance = config.create({}) as CustomComponent;
      project.addComponent(instance);
      return instance;
    }

    function customInstanceOf(project: Project): CustomComponent {
      return [...project.components].find(
        (c): c is CustomComponent => c instanceof CustomComponent
      )!;
    }

    it('saves a project placing a custom and reopens it self-contained', async () => {
      const master = registry.createMaster(
        {
          id: 'm1',
          symbol: 'M',
          numInputs: 1,
          numOutputs: 1,
          labels: ['in', 'out'],
          circuit: plugCircuit
        },
        'browser'
      );
      const project = registerBrowserProject();
      placeSnapshot(project, master);
      metadataStore.markDirty(project);

      await service.saveProject(project);
      const id = metadataStore.getMetadata(project)!.id;
      expect(id).toBeTruthy();

      const reopened = await service.loadLocalProject(id);
      const instance = customInstanceOf(reopened);
      expect(instance.numInputs).toBe(1);
      expect(instance.numOutputs).toBe(1);
    });

    it('keeps a placed instance frozen across a save when its master changes', async () => {
      const master = registry.createMaster(
        {
          id: 'm2',
          symbol: 'M',
          numInputs: 1,
          numOutputs: 0,
          labels: ['in'],
          circuit: {
            components: [
              {
                type: 100,
                pos: [0, 0],
                options: { label: 'in', index: 0 }
              }
            ],
            wires: []
          }
        },
        'browser'
      );
      const project = registerBrowserProject();
      placeSnapshot(project, master); // captures shape: 1 input

      // Master grows a second input after placement.
      registry.updateDefinition(master, {
        numInputs: 2,
        numOutputs: 0,
        labels: ['a', 'b']
      });
      metadataStore.markDirty(project);

      await service.saveProject(project);
      const id = metadataStore.getMetadata(project)!.id;

      const reopened = await service.loadLocalProject(id);
      // The embedded snapshot was frozen at place time — still 1 input.
      expect(customInstanceOf(reopened).numInputs).toBe(1);
    });

    it('saves a component master to the components store and reopens its circuit', async () => {
      const masterTypeId = registry.createMaster(
        { id: 'cm1', name: 'Comp', symbol: 'C', description: 'd' },
        'browser'
      );
      const id = registry.idForTypeId(masterTypeId)!;

      const editor = new Project();
      editor.addComponent(
        Component.deserialize(
          { pos: [0, 0], options: { label: 'in', index: 0 } },
          provider.getComponent(100)!
        )
      );
      editor.addComponent(
        Component.deserialize(
          { pos: [5, 0], options: { label: 'out', index: 0 } },
          provider.getComponent(101)!
        )
      );
      metadataStore.register(editor, {
        id,
        name: 'Comp',
        type: 'comp',
        source: 'browser',
        isPublic: false
      });
      metadataStore.markDirty(editor);

      await service.saveProject(editor);

      const record = componentStore.records.get(id)!;
      expect(record.numInputs).toBe(1);
      expect(record.numOutputs).toBe(1);
      expect(record.labels).toEqual(['in', 'out']);
      expect(record.symbol).toBe('C');

      const { project: reopened, masterTypeId: reopenedType } =
        await service.loadComponentForEdit(id);
      // The session master is reused, not duplicated.
      expect(reopenedType).toBe(masterTypeId);
      expect([...reopened.components].length).toBe(2);
    });

    it('loadComponentForEdit rejects when no master record exists', async () => {
      await expect(service.loadComponentForEdit('missing')).rejects.toThrow();
    });

    function importedCustomContent(): string {
      // A file embedding one custom, provenance id 'external-id'.
      return JSON.stringify({
        version: 1,
        name: 'Imported',
        components: [{ type: 1000, pos: [3, 3], options: {} }],
        wires: '',
        definitions: [
          {
            type: 1000,
            source: { id: 'external-id', version: 2 },
            name: 'Ext',
            symbol: 'E',
            description: '',
            numInputs: 1,
            numOutputs: 1,
            labels: ['in', 'out'],
            components: plugCircuit.components,
            wires: ''
          }
        ]
      });
    }

    it('importProjectFromJson keeps a master-less custom embedded, not adopted', async () => {
      const project = await service.importProjectFromJson(
        importedCustomContent()
      );

      // The instance renders from its embedded snapshot…
      const instance = customInstanceOf(project);
      expect(instance.numInputs).toBe(1);
      // …but no browser master was created: the custom stays an embedded
      // (restorable) snapshot instead of silently entering the library.
      expect(componentStore.records.size).toBe(0);
      expect(registry.masterTypeIdForId('external-id')).toBeUndefined();
      expect(registry.resolveMaster(instance.config.type)).toBeUndefined();
    });

    it('importProjectFromJson re-links a custom whose master is already local', async () => {
      const masterTypeId = registry.createMaster(
        {
          id: 'external-id',
          version: 2,
          name: 'Ext',
          symbol: 'E',
          numInputs: 1,
          numOutputs: 1,
          labels: ['in', 'out'],
          circuit: plugCircuit
        },
        'browser'
      );

      const project = await service.importProjectFromJson(
        importedCustomContent()
      );

      // The instance resolves to the existing master; no duplicate is created.
      const instance = customInstanceOf(project);
      expect(registry.resolveMaster(instance.config.type)?.masterTypeId).toBe(
        masterTypeId
      );
      expect(componentStore.records.size).toBe(0);
    });
  });

  describe('custom component persistence (server)', () => {
    const plugCircuit: SerializedCircuitBody = {
      components: [
        {
          type: 100,
          pos: [0, 0],
          options: { label: 'in', index: 0 }
        },
        {
          type: 101,
          pos: [5, 0],
          options: { label: 'out', index: 0 }
        }
      ],
      wires: []
    };

    function customInstanceOf(project: Project): CustomComponent {
      return [...project.components].find(
        (c): c is CustomComponent => c instanceof CustomComponent
      )!;
    }

    // Snapshot a master and place an instance, mirroring snapshot-on-place.
    function placeSnapshot(project: Project, masterTypeId: number): void {
      const def = registry.snapshot(masterTypeId);
      const config = provider.getComponent(def.typeId)!;
      project.addComponent(config.create({}));
    }

    it('promoteComponentToServer uploads a local master, flips it to server, and removes the local record', async () => {
      // A local master with its circuit stored in the browser components store.
      const circuitFile = TestBed.inject(CircuitFileService);
      const content = circuitFile.toJson(new Project(), 'Comp');
      await componentStore.save({
        id: 'local-1',
        version: 1,
        name: 'Comp',
        symbol: 'C',
        description: '',
        numInputs: 0,
        numOutputs: 0,
        labels: [],
        content
      });
      const masterTypeId = registry.createMaster(
        { id: 'local-1', symbol: 'C', name: 'Comp' },
        'browser'
      );

      // The POST is issued only after the store read + temp-project build, so
      // flush pending microtasks (a macrotask tick) before the HTTP expectation.
      const tick = () => new Promise((r) => setTimeout(r, 0));

      const promise = promotion.promoteComponentToServer(masterTypeId);

      await tick();
      const post = httpMock.expectOne(COMPONENTS_URL);
      expect(post.request.method).toBe('POST');
      // The circuit rides along with the create — one round trip.
      expect(post.request.body.document.version).toBe(1);
      post.flush(
        componentSummaryResponse({ id: uuid('srv-comp'), version: 5 })
      );

      await promise;

      const def = registry.getDefinition(masterTypeId)!;
      expect(def.source).toBe('server');
      expect(def.id).toBe(uuid('srv-comp'));
      expect(def.version).toBe(5);
      // Old local id still resolves (alias) and was persisted to the id-map.
      expect(registry.masterTypeIdForId('local-1')).toBe(masterTypeId);
      expect(idMapStore.records.get('local-1')).toBe(uuid('srv-comp'));
      // The local record is gone — the component moved to the cloud.
      expect(await componentStore.get('local-1')).toBeUndefined();
    });

    it('promoteComponentToServer rejects a server master (nothing to upload)', async () => {
      const masterTypeId = registry.createMaster(
        { id: 'srv-x', symbol: 'X' },
        'server'
      );
      await expect(
        promotion.promoteComponentToServer(masterTypeId)
      ).rejects.toThrow();
    });

    it('promoteComponentToServer succeeds (no throw) even if the local cleanup fails after the upload', async () => {
      const circuitFile = TestBed.inject(CircuitFileService);
      await componentStore.save({
        id: 'local-1',
        version: 1,
        name: 'Comp',
        symbol: 'C',
        description: '',
        numInputs: 0,
        numOutputs: 0,
        labels: [],
        content: circuitFile.toJson(new Project(), 'Comp')
      });
      const masterTypeId = registry.createMaster(
        { id: 'local-1', symbol: 'C', name: 'Comp' },
        'browser'
      );
      // The upload has already committed server-side when the local record delete
      // fails — the operation must NOT surface as a failure (that would lie and
      // hide the now-disabled retry).
      vi.spyOn(componentStore, 'delete').mockRejectedValue(new Error('boom'));
      const tick = () => new Promise((r) => setTimeout(r, 0));

      const promise = promotion.promoteComponentToServer(masterTypeId);
      await tick();
      httpMock
        .expectOne(COMPONENTS_URL)
        .flush(componentSummaryResponse({ id: uuid('srv-comp'), version: 5 }));

      await expect(promise).resolves.toBeUndefined();
      const def = registry.getDefinition(masterTypeId)!;
      expect(def.source).toBe('server');
      // The durable alias was written before the (failed) delete, so a reload
      // self-heals (the browser preload skips the orphaned record).
      expect(idMapStore.records.get('local-1')).toBe(uuid('srv-comp'));
    });

    it('promoteComponentToServer re-points an open editor of the master to the new server identity', async () => {
      const circuitFile = TestBed.inject(CircuitFileService);
      await componentStore.save({
        id: 'local-1',
        version: 1,
        name: 'Comp',
        symbol: 'C',
        description: '',
        numInputs: 0,
        numOutputs: 0,
        labels: [],
        content: circuitFile.toJson(new Project(), 'Comp')
      });
      const masterTypeId = registry.createMaster(
        { id: 'local-1', symbol: 'C', name: 'Comp' },
        'browser'
      );
      // The master's editor tab is open (browser comp), registered under its old id.
      const editor = new Project();
      metadataStore.register(editor, {
        id: 'local-1',
        name: 'Comp',
        type: 'comp',
        source: 'browser',
        isPublic: false
      });
      const tick = () => new Promise((r) => setTimeout(r, 0));

      const promise = promotion.promoteComponentToServer(masterTypeId);
      await tick();
      httpMock
        .expectOne(COMPONENTS_URL)
        .flush(componentSummaryResponse({ id: uuid('srv-comp'), version: 5 }));
      await promise;

      // The editor now points at the cloud record, so a later save routes to the
      // server instead of re-creating the deleted browser record.
      const meta = metadataStore.getMetadata(editor)!;
      expect(meta.source).toBe('server');
      expect(meta.id).toBe(uuid('srv-comp'));
      expect(meta.version).toBe(5);
      editor.destroy();
    });

    it('preloadBrowserMasters skips a record whose id was promoted to the cloud', async () => {
      const circuitFile = TestBed.inject(CircuitFileService);
      // The cloud master and the persisted promotion alias (as hydrated at startup).
      const serverType = registry.createMaster(
        { id: uuid('srv-1'), symbol: 'C', name: 'Comp' },
        'server'
      );
      registry.registerIdAlias('local-1', uuid('srv-1'));
      // A stale local record left behind by a partially-failed promotion.
      await componentStore.save({
        id: 'local-1',
        version: 1,
        name: 'Comp',
        symbol: 'C',
        description: '',
        numInputs: 0,
        numOutputs: 0,
        labels: [],
        content: circuitFile.toJson(new Project(), 'Comp')
      });

      await library.preloadBrowserMasters();

      // No browser duplicate: the old id still resolves through the alias to the
      // single (server) master, instead of a freshly-registered browser dupe.
      expect(registry.masterTypeIdForId('local-1')).toBe(serverType);
      expect(registry.getDefinition(serverType)?.source).toBe('server');
    });

    it('localDependencies returns [] for a master with no embedded customs', async () => {
      const circuitFile = TestBed.inject(CircuitFileService);
      await componentStore.save({
        id: 'local-2',
        version: 1,
        name: 'Plain',
        symbol: 'P',
        description: '',
        numInputs: 0,
        numOutputs: 0,
        labels: [],
        content: circuitFile.toJson(new Project(), 'Plain')
      });
      const masterTypeId = registry.createMaster(
        { id: 'local-2', symbol: 'P' },
        'browser'
      );
      expect(await promotion.localDependencies(masterTypeId)).toEqual([]);
    });

    it('localDependencies lists the local customs a master embeds, with resolvable master type ids', async () => {
      const circuitFile = TestBed.inject(CircuitFileService);
      // Local dependency master B, embedded by master A.
      const bType = registry.createMaster(
        { id: 'dep-b', symbol: 'B', name: 'Dep B' },
        'browser'
      );
      const aProject = new Project();
      placeSnapshot(aProject, bType);
      const contentA = circuitFile.toJson(aProject, 'A');
      aProject.destroy();

      await componentStore.save({
        id: 'local-a',
        version: 1,
        name: 'A',
        symbol: 'A',
        description: '',
        numInputs: 0,
        numOutputs: 0,
        labels: [],
        content: contentA
      });
      const aType = registry.createMaster(
        { id: 'local-a', symbol: 'A', name: 'A' },
        'browser'
      );

      expect(await promotion.localDependencies(aType)).toEqual([
        { name: 'Dep B', masterTypeId: bType }
      ]);
    });

    it('localDependencies omits a dependency already promoted to the cloud', async () => {
      const circuitFile = TestBed.inject(CircuitFileService);
      const bType = registry.createMaster(
        { id: 'dep-b', symbol: 'B', name: 'Dep B' },
        'browser'
      );
      const aProject = new Project();
      placeSnapshot(aProject, bType);
      const contentA = circuitFile.toJson(aProject, 'A');
      aProject.destroy();

      await componentStore.save({
        id: 'local-a',
        version: 1,
        name: 'A',
        symbol: 'A',
        description: '',
        numInputs: 0,
        numOutputs: 0,
        labels: [],
        content: contentA
      });
      const aType = registry.createMaster(
        { id: 'local-a', symbol: 'A', name: 'A' },
        'browser'
      );

      // B is now in the cloud: promoting flips its source and records the alias,
      // so the stored snapshot's old id resolves to a server master.
      registry.promoteMaster(bType, 'srv-b', 2);

      expect(await promotion.localDependencies(aType)).toEqual([]);
    });

    it('localDependenciesOfProject walks a live project, children before parents', () => {
      // C (leaf) embedded by B; the live project places B.
      const cType = registry.createMaster(
        { id: 'dep-c', symbol: 'C', name: 'Dep C' },
        'browser'
      );
      // B's circuit places C — reference C's type id directly (the walk resolves
      // any custom type through its provenance id, master or snapshot alike).
      const bType = registry.createMaster(
        {
          id: 'dep-b',
          symbol: 'B',
          name: 'Dep B',
          circuit: {
            components: [{ type: cType, pos: [0, 0], options: {} }],
            wires: []
          }
        },
        'browser'
      );

      const project = new Project();
      placeSnapshot(project, bType);
      const deps = promotion.localDependenciesOfProject(project);
      project.destroy();

      // Children before parents: C precedes B (upload order).
      expect(deps.map((d) => d.name)).toEqual(['Dep C', 'Dep B']);
      expect(deps.map((d) => d.masterTypeId)).toEqual([cType, bType]);
    });

    it('localDependenciesOfProject orders a diamond children-before-parents', () => {
      // A places B and C; both B and C place D. Every dependency must precede
      // each one that embeds it — a plain reverse of collect order would put the
      // shared D after one of its parents.
      const ref = (type: number) => ({
        type,
        pos: [0, 0] as [number, number],
        options: {}
      });
      const dType = registry.createMaster({ id: 'd', name: 'D' }, 'browser');
      const bType = registry.createMaster(
        {
          id: 'b',
          name: 'B',
          circuit: { components: [ref(dType)], wires: [] }
        },
        'browser'
      );
      const cType = registry.createMaster(
        {
          id: 'c',
          name: 'C',
          circuit: { components: [ref(dType)], wires: [] }
        },
        'browser'
      );
      const aType = registry.createMaster(
        {
          id: 'a',
          name: 'A',
          circuit: { components: [ref(bType), ref(cType)], wires: [] }
        },
        'browser'
      );

      const project = new Project();
      placeSnapshot(project, aType);
      const order = promotion
        .localDependenciesOfProject(project)
        .map((d) => d.name);
      project.destroy();

      const idx = (n: string) => order.indexOf(n);
      expect(idx('D')).toBeLessThan(idx('B'));
      expect(idx('D')).toBeLessThan(idx('C'));
      expect(idx('B')).toBeLessThan(idx('A'));
      expect(idx('C')).toBeLessThan(idx('A'));
    });

    // Ingests one orphan snapshot (no master resolves for its id) and returns
    // its session type id.
    function ingestOrphan(
      source:
        | { id: string; version: number; origin?: 'server' | 'browser' }
        | undefined
    ): number {
      const remap = registry.ingestSnapshots([
        {
          type: CUSTOM_TYPE_ID_BASE,
          source,
          name: 'Lost',
          symbol: 'L',
          description: '',
          numInputs: 0,
          numOutputs: 0,
          labels: [],
          components: [],
          wires: []
        }
      ]);
      return remap.get(CUSTOM_TYPE_ID_BASE)!;
    }

    it('restoreOrphanToLibrary reuses the id and re-links instances', async () => {
      const snapType = ingestOrphan({
        id: 'lost-local',
        version: 2,
        origin: 'browser'
      });
      expect(registry.resolveMaster(snapType)).toBeUndefined();

      const masterId = await library.restoreOrphanToLibrary(snapType);

      expect(masterId).toBe('lost-local');
      // Re-linked: the placed snapshot now resolves to the restored master.
      const resolved = registry.resolveMaster(snapType);
      expect(resolved?.master.source).toBe('browser');
      expect(resolved?.master.version).toBe(2); // frozen version adopted
      expect(await componentStore.get('lost-local')).toBeDefined();
    });

    it('restoreOrphanToLibrary mints a fresh id for an anonymous snapshot', async () => {
      const snapType = ingestOrphan(undefined);
      expect(registry.resolveMaster(snapType)).toBeUndefined();

      const masterId = await library.restoreOrphanToLibrary(snapType);

      expect(masterId).toBeTruthy();
      // The snapshot was re-pointed at the fresh master, so it resolves now.
      expect(registry.resolveMaster(snapType)?.master.id).toBe(masterId);
    });

    it('restoreOrphanToLibrary returns null for a non-orphan', async () => {
      const master = registry.createMaster(
        { id: 'has-master', symbol: 'M' },
        'browser'
      );
      const snapType = registry.snapshot(master).typeId;
      expect(await library.restoreOrphanToLibrary(snapType)).toBeNull();
    });

    it('preloadServerMasters registers cloud masters from the list alone (no per-component fetch)', async () => {
      const tick = () => new Promise((r) => setTimeout(r, 0));
      const promise = library.preloadServerMasters();

      await tick();
      const list = httpMock.expectOne(COMPONENTS_PAGE_URL);
      expect(list.request.method).toBe('GET');
      list.flush({
        entries: [
          {
            ...componentSummaryResponse({
              id: uuid('srv-1'),
              name: 'Cloud Comp',
              version: 2
            }),
            symbol: 'CL',
            numInputs: 1,
            numOutputs: 1,
            labels: ['a', 'q']
          }
        ],
        page: 0,
        pageSize: 100,
        total: 1
      });

      await promise;

      const typeId = registry.masterTypeIdForId(uuid('srv-1'));
      expect(typeId).toBeDefined();
      const def = registry.getDefinition(typeId!)!;
      expect(def.source).toBe('server');
      expect(def.name).toBe('Cloud Comp');
      expect(def.numInputs).toBe(1);
      expect(def.version).toBe(2);
      // No circuit yet — it is fetched lazily on first placement / update.
      expect(def.circuit).toBeUndefined();
      // verify() in afterEach asserts no per-component GET was issued.
    });

    it('ensureServerMasterCircuit fetches and sets the circuit on demand', async () => {
      const tick = () => new Promise((r) => setTimeout(r, 0));
      const masterTypeId = registry.createMaster(
        { id: uuid('srv-2'), symbol: 'C', name: 'C' },
        'server'
      );
      expect(registry.getDefinition(masterTypeId)?.circuit).toBeUndefined();

      const promise = library.ensureServerMasterCircuit(masterTypeId);
      await tick();
      const open = httpMock.expectOne(COMPONENT_URL(uuid('srv-2')));
      expect(open.request.method).toBe('GET');
      open.flush(componentDetailResponse({ id: uuid('srv-2'), name: 'C' }));
      await promise;

      expect(registry.getDefinition(masterTypeId)?.circuit).toBeDefined();
    });

    it('ensureServerMasterCircuit is a no-op for a browser master (no fetch)', async () => {
      const masterTypeId = registry.createMaster(
        { id: 'local-x', symbol: 'X' },
        'browser'
      );
      await library.ensureServerMasterCircuit(masterTypeId);
      // verify() in afterEach asserts no HTTP request was made.
    });

    it('fetches a server master circuit once, shared by placement and edit-open', async () => {
      const tick = () => new Promise((r) => setTimeout(r, 0));
      const masterTypeId = registry.createMaster(
        { id: uuid('srv-cache'), symbol: 'C', name: 'C' },
        'server'
      );

      // First use (place-time): one GET populates the cache.
      const ensure = library.ensureServerMasterCircuit(masterTypeId);
      await tick();
      httpMock
        .expectOne(COMPONENT_URL(uuid('srv-cache')))
        .flush(componentDetailResponse({ id: uuid('srv-cache'), version: 3 }));
      await ensure;

      // Second use (edit-open) is served from the cache: no second GET (the
      // afterEach verify() would fail on an outstanding request), and the editor
      // adopts the cached version so its save keeps a valid concurrency check.
      const { project, masterTypeId: editType } =
        await service.loadServerComponentForEdit(uuid('srv-cache'));
      expect(editType).toBe(masterTypeId);
      expect(metadataStore.getMetadata(project)!.version).toBe(3);
    });

    it('invalidates the cached circuit on save so a reopen re-fetches', async () => {
      const tick = () => new Promise((r) => setTimeout(r, 0));
      const masterTypeId = registry.createMaster(
        { id: uuid('srv-inv'), symbol: 'C', name: 'C' },
        'server'
      );

      const ensure = library.ensureServerMasterCircuit(masterTypeId);
      await tick();
      httpMock
        .expectOne(COMPONENT_URL(uuid('srv-inv')))
        .flush(componentDetailResponse({ id: uuid('srv-inv'), version: 1 }));
      await ensure;

      const { project } = await service.loadServerComponentForEdit(
        uuid('srv-inv')
      );
      metadataStore.markDirty(project);

      const save = service.saveProject(project);
      await tick();
      const put = httpMock.expectOne(COMPONENT_URL(uuid('srv-inv')));
      expect(put.request.method).toBe('PUT');
      put.flush(componentSummaryResponse({ id: uuid('srv-inv'), version: 2 }));
      await save;

      // The save dropped the cache entry: the next edit-open goes back to the API
      // rather than serving the pre-save circuit.
      const reopen = service.loadServerComponentForEdit(uuid('srv-inv'));
      await tick();
      const get = httpMock.expectOne(COMPONENT_URL(uuid('srv-inv')));
      expect(get.request.method).toBe('GET');
      get.flush(componentDetailResponse({ id: uuid('srv-inv'), version: 2 }));
      const { project: reopened } = await reopen;
      expect(metadataStore.getMetadata(reopened)!.version).toBe(2);
    });

    it('preloadServerMasters is a silent no-op when signed out (list 401s)', async () => {
      const tick = () => new Promise((r) => setTimeout(r, 0));
      const promise = library.preloadServerMasters();

      await tick();
      const list = httpMock.expectOne(COMPONENTS_PAGE_URL);
      list.flush(apiError('unauthorized', 'Not signed in'), {
        status: 401,
        statusText: 'Unauthorized'
      });

      await expect(promise).resolves.toBeUndefined();
    });

    it('createServerComponent POSTs once and registers a server master', async () => {
      const promise = service.createServerComponent({
        name: 'Comp',
        symbol: 'C',
        description: 'd'
      });

      // A new component starts on an empty board, so the create carries no
      // document at all and there is no initial save to establish a version.
      const post = httpMock.expectOne(COMPONENTS_URL);
      expect(post.request.method).toBe('POST');
      expect(post.request.body).toEqual({
        name: 'Comp',
        symbol: 'C',
        description: 'd',
        public: false
      });
      post.flush(
        componentSummaryResponse({ id: uuid('srv-comp'), version: 1 })
      );

      const { project, masterTypeId } = await promise;
      const meta = metadataStore.getMetadata(project)!;
      expect(meta.type).toBe('comp');
      expect(meta.source).toBe('server');
      expect(meta.version).toBe(1);
      expect(registry.masterTypeIdForId(uuid('srv-comp'))).toBe(masterTypeId);
    });

    it('loadServerComponent revives the embedded snapshot — ports come from it (Inv. A)', async () => {
      // The document is self-contained: every custom it places travels with it
      // as a frozen definition, so opening it needs no second fetch.
      const dependency: SnapshotDefinition = {
        type: CUSTOM_TYPE_ID_BASE,
        source: { id: 'dep-master', version: 6, origin: 'server' },
        name: 'Dep',
        symbol: 'D',
        description: '',
        numInputs: 1,
        numOutputs: 1,
        labels: ['in', 'out'],
        components: plugCircuit.components,
        wires: []
      };
      const promise = service.loadServerComponent(uuid('host-comp'));

      const get = httpMock.expectOne(COMPONENT_URL(uuid('host-comp')));
      expect(get.request.method).toBe('GET');
      get.flush(
        componentDetailResponse({
          id: uuid('host-comp'),
          name: 'Host',
          version: 4,
          body: {
            components: [
              { type: CUSTOM_TYPE_ID_BASE, pos: [3, 3], options: {} }
            ],
            wires: []
          },
          definitions: [dependency]
        })
      );

      const { project, masterTypeId } = await promise;
      const instance = customInstanceOf(project);
      // The instance's arity comes from the embedded definition.
      expect(instance.numInputs).toBe(1);
      expect(instance.numOutputs).toBe(1);
      expect(metadataStore.getMetadata(project)!.source).toBe('server');
      expect(metadataStore.getMetadata(project)!.version).toBe(4);
      expect(registry.masterTypeIdForId(uuid('host-comp'))).toBe(masterTypeId);
    });

    it('a server project save embeds a self-contained definition of every custom it places', async () => {
      const master = registry.createMaster(
        {
          id: 'pm1',
          version: 3,
          symbol: 'M',
          numInputs: 1,
          numOutputs: 1,
          labels: ['in', 'out'],
          circuit: plugCircuit
        },
        'server'
      );
      const project = new Project();
      metadataStore.register(project, {
        id: uuid('proj-1'),
        name: 'P',
        type: 'project',
        source: 'server',
        version: 1,
        isPublic: false
      });
      placeSnapshot(project, master);
      metadataStore.markDirty(project);

      const promise = service.saveProject(project);
      const put = httpMock.expectOne(PROJECT_URL(uuid('proj-1')));
      expect(put.request.method).toBe('PUT');
      const definition = put.request.body.document.definitions[0];
      // Provenance, so the server can derive the dependency edge and a reader
      // can tell whether the master has moved on since the snapshot was taken.
      expect(definition.source).toEqual({
        id: 'pm1',
        version: 3,
        origin: 'server'
      });
      expect(definition.numInputs).toBe(1);
      expect(definition.labels).toEqual(['in', 'out']);
      expect(definition.components.length).toBeGreaterThan(0);
      put.flush(projectSummaryResponse({ id: uuid('proj-1'), version: 2 }));

      await promise;
      expect(metadataStore.isDirty(project)).toBe(false);
    });

    it('a server component save sends only the document and adopts the returned version', async () => {
      const masterType = registry.createMaster(
        { id: uuid('ec1'), version: 2, symbol: 'E' },
        'server'
      );
      const editor = new Project();
      metadataStore.register(editor, {
        id: uuid('ec1'),
        name: 'E',
        type: 'comp',
        source: 'server',
        version: 2,
        isPublic: false
      });
      editor.addComponent(
        Component.deserialize(
          { pos: [0, 0], options: { label: 'in', index: 0 } },
          provider.getComponent(100)!
        )
      );
      metadataStore.markDirty(editor);

      const promise = service.saveProject(editor);
      const put = httpMock.expectOne(COMPONENT_URL(uuid('ec1')));
      expect(put.request.method).toBe('PUT');
      // No port surface in the body: the plugs in the circuit are what a
      // component's ports *are*, so a client declaring them could only ever
      // disagree with the document it sent them beside.
      expect(Object.keys(put.request.body).sort()).toEqual([
        'document',
        'version'
      ]);
      expect(put.request.body.version).toBe(2);
      put.flush(componentSummaryResponse({ id: uuid('ec1'), version: 7 }));

      await promise;
      // The server's save-time version stamp is adopted onto the master.
      expect(registry.getDefinition(masterType)!.version).toBe(7);
      expect(metadataStore.isDirty(editor)).toBe(false);
    });
  });
});
