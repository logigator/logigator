/* eslint-disable @typescript-eslint/no-empty-function */

import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { TranslocoService } from '@jsverse/transloco';
import { AuthRequiredError, PersistenceService } from './persistence.service';
import { ProjectMetadataStore } from './project-metadata.store';
import { ProjectService } from '../project/project.service';
import { Project } from '../project/project';
import { ProjectElement } from '../api/models/project-element';
import { environment } from '../../environments/environment';
import { InvalidFileError } from './file/circuit-file.errors';
import { BrowserProjectStore } from './browser/browser-project.store';
import { BrowserComponentStore } from './browser/browser-component.store';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { ComponentProviderService } from '../components/component-provider.service';
import { CustomComponent } from '../components/custom/custom-component';
import { Component } from '../components/component';
import { SerializedCircuitBody } from './serialized-circuit';
import {
  FakeBrowserComponentStore,
  FakeBrowserProjectStore
} from '../../testing/fake-browser-stores';
import { configureTestBed } from '../../testing/configure-test-bed';

const PROJECT_URL = (uuid: string) =>
  `${environment.apiUrl}/api/project/${uuid}`;
const SHARE_URL = (link: string) => `${environment.apiUrl}/api/share/${link}`;
const CLONE_URL = (link: string) =>
  `${environment.apiUrl}/api/project/clone/${link}`;
const USER_URL = `${environment.apiUrl}/api/user`;
const PROJECTS_LIST_URL = `${environment.apiUrl}/api/project`;

function projectDetailResponse(
  overrides: Partial<{
    id: string;
    name: string;
    hash: string;
    elements: ProjectElement[];
    public: boolean;
  }> = {}
) {
  return {
    status: 200,
    data: {
      id: overrides.id ?? 'test-uuid',
      name: overrides.name ?? 'Test Project',
      description: '',
      createdOn: '2024-01-01',
      lastEdited: '2024-01-01',
      elementsFile: {
        hash: overrides.hash ?? 'hash-1',
        mimeType: 'application/json',
        publicUrl: ''
      },
      previewDark: null,
      previewLight: null,
      public: overrides.public ?? false,
      dependencies: [],
      elements: overrides.elements ?? []
    }
  };
}

function projectSummaryResponse(
  overrides: Partial<{
    id: string;
    name: string;
    hash: string;
  }> = {}
) {
  return {
    status: 200,
    data: {
      id: overrides.id ?? 'test-uuid',
      name: overrides.name ?? 'Test',
      description: '',
      createdOn: '2024-01-01',
      lastEdited: '2024-01-01',
      elementsFile: {
        hash: overrides.hash ?? 'hash-1',
        mimeType: 'application/json',
        publicUrl: ''
      },
      previewDark: null,
      previewLight: null,
      public: false
    }
  };
}

function shareDetailResponse(
  overrides: Partial<{
    id: string;
    name: string;
    type: 'project' | 'comp';
    elements: ProjectElement[];
  }> = {}
) {
  return {
    status: 200,
    data: {
      type: overrides.type ?? 'project',
      id: overrides.id ?? 'share-uuid',
      name: overrides.name ?? 'Shared',
      description: '',
      createdOn: '2024-01-01',
      lastEdited: '2024-01-01',
      link: 'share-link',
      public: true,
      previewDark: null,
      previewLight: null,
      elementsFile: { hash: 'share-hash' },
      dependencies: [],
      elements: overrides.elements ?? []
    }
  };
}

describe('PersistenceService', () => {
  let service: PersistenceService;
  let metadataStore: ProjectMetadataStore;
  let projectService: ProjectService;
  let httpMock: HttpTestingController;
  let locationGo: Mock;
  let browserStore: FakeBrowserProjectStore;
  let componentStore: FakeBrowserComponentStore;
  let registry: CustomComponentRegistry;
  let provider: ComponentProviderService;

  beforeEach(() => {
    // Console output from expected error-path tests is suppressed.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    locationGo = vi.fn();
    browserStore = new FakeBrowserProjectStore();
    componentStore = new FakeBrowserComponentStore();
    configureTestBed([
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
      {
        provide: TranslocoService,
        useValue: {
          translate: vi.fn().mockName('TranslocoService.translate')
        }
      }
    ]);
    service = TestBed.inject(PersistenceService);
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
        id: 'test-uuid',
        name: 'Test',
        type: 'project',
        source: 'server',
        hash: 'abc123',
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
          id: 'share-uuid',
          name: 'Shared',
          type: 'project',
          source: 'share',
          hash: '',
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
        hash: '',
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

    it('PUTs elements, updates hash, and clears dirty on success', async () => {
      const project = new Project();
      metadataStore.register(project, {
        id: 'test-uuid',
        name: 'Test',
        type: 'project',
        source: 'server',
        hash: 'old-hash',
        isPublic: false
      });
      metadataStore.markDirty(project);

      const promise = service.saveProject(project);

      const req = httpMock.expectOne(PROJECT_URL('test-uuid'));
      expect(req.request.method).toBe('PUT');
      expect(req.request.body.oldHash).toBe('old-hash');
      req.flush(projectSummaryResponse({ hash: 'new-hash' }));

      await promise;
      expect(metadataStore.getMetadata(project)!.hash).toBe('new-hash');
      expect(metadataStore.isDirty(project)).toBe(false);
    });

    it('deduplicates concurrent saves into a single request', async () => {
      const project = new Project();
      metadataStore.register(project, {
        id: 'test-uuid',
        name: 'Test',
        type: 'project',
        source: 'server',
        hash: 'abc123',
        isPublic: false
      });
      metadataStore.markDirty(project);

      const promise1 = service.saveProject(project);
      const promise2 = service.saveProject(project);

      // expectOne asserts exactly one request was issued (dedup worked).
      const req = httpMock.expectOne(PROJECT_URL('test-uuid'));
      req.flush(projectSummaryResponse({ hash: 'new-hash' }));

      await Promise.all([promise1, promise2]);
      expect(metadataStore.getMetadata(project)!.hash).toBe('new-hash');
    });

    it('on VersionMismatch: rejects, leaves hash unchanged and dirty true', async () => {
      const project = new Project();
      metadataStore.register(project, {
        id: 'test-uuid',
        name: 'Test',
        type: 'project',
        source: 'server',
        hash: 'stale-hash',
        isPublic: false
      });
      metadataStore.markDirty(project);

      const promise = service.saveProject(project);

      const req = httpMock.expectOne(PROJECT_URL('test-uuid'));
      req.flush(
        { status: 400, message: 'VersionMismatch' },
        { status: 400, statusText: 'Bad Request' }
      );

      await expect(promise).rejects.toThrow();
      expect(metadataStore.getMetadata(project)!.hash).toBe('stale-hash');
      expect(metadataStore.isDirty(project)).toBe(true);
    });

    it('keeps dirty=true when an edit lands during the save (race protection)', async () => {
      const project = new Project();
      metadataStore.register(project, {
        id: 'test-uuid',
        name: 'Test',
        type: 'project',
        source: 'server',
        hash: 'h0',
        isPublic: false
      });
      metadataStore.markDirty(project);

      const promise = service.saveProject(project);

      // Simulate an edit landing while the save HTTP request is in flight
      metadataStore.markDirty(project);

      const req = httpMock.expectOne(PROJECT_URL('test-uuid'));
      req.flush(projectSummaryResponse({ hash: 'h1' }));

      await promise;

      // Hash advances, but dirty stays true because a concurrent edit
      // fired while we were saving the previous snapshot.
      expect(metadataStore.getMetadata(project)!.hash).toBe('h1');
      expect(metadataStore.isDirty(project)).toBe(true);
    });
  });

  describe('loadProject', () => {
    it('loads project, populates metadata, and starts clean', async () => {
      const elements: ProjectElement[] = [{ t: 1, p: [5, 3], i: 1, o: 1 }];
      const loadPromise = service.loadProject('test-uuid');

      const req = httpMock.expectOne(PROJECT_URL('test-uuid'));
      expect(req.request.method).toBe('GET');
      req.flush(projectDetailResponse({ elements, hash: 'h1' }));

      const project = await loadPromise;
      const metadata = metadataStore.getMetadata(project);
      expect(metadata!.id).toBe('test-uuid');
      expect(metadata!.hash).toBe('h1');
      expect(metadata!.source).toBe('server');
      expect(metadataStore.isDirty(project)).toBe(false);
      expect(Array.from(project.components).length).toBe(1);
    });

    it('rejects when the API returns 404', async () => {
      const loadPromise = service.loadProject('missing');
      const req = httpMock.expectOne(PROJECT_URL('missing'));
      req.flush(
        { status: 404, message: 'NotFound' },
        { status: 404, statusText: 'Not Found' }
      );
      await expect(loadPromise).rejects.toThrow();
    });
  });

  describe('loadProjectAsMain', () => {
    it('replaces main project and registers it', async () => {
      const promise = service.loadProjectAsMain('uuid-1');

      const req = httpMock.expectOne(PROJECT_URL('uuid-1'));
      req.flush(projectDetailResponse({ id: 'uuid-1' }));

      await promise;

      expect(projectService.mainProject()).toBeDefined();
      expect(metadataStore.getMetadata(projectService.mainProject()!)?.id).toBe(
        'uuid-1'
      );
      expect(locationGo).toHaveBeenCalledWith('/project/uuid-1');
    });

    it('skips URL update when skipUrlUpdate=true', async () => {
      const promise = service.loadProjectAsMain('uuid-1', {
        skipUrlUpdate: true
      });

      const req = httpMock.expectOne(PROJECT_URL('uuid-1'));
      req.flush(projectDetailResponse({ id: 'uuid-1' }));

      await promise;
      expect(locationGo).not.toHaveBeenCalled();
    });

    it('on 404: does not throw and falls back to an empty placeholder', async () => {
      const promise = service.loadProjectAsMain('missing');

      const req = httpMock.expectOne(PROJECT_URL('missing'));
      req.flush(
        { status: 404, message: 'NotFound' },
        { status: 404, statusText: 'Not Found' }
      );

      await promise;

      const main = projectService.mainProject();
      expect(main).toBeDefined();
      expect(metadataStore.getMetadata(main!)?.source).toBe('browser');
      expect(locationGo).not.toHaveBeenCalled();
    });

    it('stale loads are discarded with full cleanup (no metadata leak)', async () => {
      // Start load A
      const promiseA = service.loadProjectAsMain('uuid-a');

      // Before A resolves, start load B — bumps the token
      const promiseB = service.loadProjectAsMain('uuid-b');

      // Resolve B first
      httpMock
        .expectOne(PROJECT_URL('uuid-b'))
        .flush(projectDetailResponse({ id: 'uuid-b' }));

      // Now resolve A — this is stale; the project must be disposed and
      // its metadata removed from the store.
      httpMock
        .expectOne(PROJECT_URL('uuid-a'))
        .flush(projectDetailResponse({ id: 'uuid-a' }));

      await Promise.all([promiseA, promiseB]);

      // Only B's project should be in the metadata store
      const handle = metadataStore.getHandleById('uuid-a');
      expect(handle).toBeUndefined();
      expect(metadataStore.getHandleById('uuid-b')).toBeDefined();
      expect(projectService.mainProject()).toBe(
        metadataStore.getHandleById('uuid-b')!.project
      );
    });
  });

  describe('loadShare / loadShareAsMain', () => {
    it('loadShare returns a non-dirty-tracked project with source=share', async () => {
      const promise = service.loadShare('link-1');

      const req = httpMock.expectOne(SHARE_URL('link-1'));
      req.flush(shareDetailResponse({ id: 'share-1' }));

      const { project, type } = await promise;
      expect(type).toBe('project');
      expect(metadataStore.getMetadata(project)!.source).toBe('share');
      expect(metadataStore.isDirty(project)).toBe(false);
    });

    it('loadShareAsMain swaps main project for project-type shares', async () => {
      const promise = service.loadShareAsMain('link-1');

      httpMock
        .expectOne(SHARE_URL('link-1'))
        .flush(shareDetailResponse({ id: 'share-1', type: 'project' }));

      await promise;

      const main = projectService.mainProject();
      expect(metadataStore.getMetadata(main!)?.source).toBe('share');
    });

    it('loadShareAsMain adds component-type shares to open components', async () => {
      // Establish a main project first so the comp doesn't become main
      service.createAndSetEmptyProject();
      const initialMain = projectService.mainProject();

      const promise = service.loadShareAsMain('link-comp');

      httpMock
        .expectOne(SHARE_URL('link-comp'))
        .flush(shareDetailResponse({ id: 'comp-1', type: 'comp' }));

      await promise;

      expect(projectService.mainProject()).toBe(initialMain);
      expect(projectService.openComponents().length).toBe(1);
    });
  });

  describe('createProject', () => {
    it('POSTs, then PUTs initial empty save, sets as main, updates URL', async () => {
      const promise = service.createProject('My Project', undefined, false);

      // POST /api/project
      const postReq = httpMock.expectOne(PROJECTS_LIST_URL);
      expect(postReq.request.method).toBe('POST');
      expect(postReq.request.body).toEqual({
        name: 'My Project',
        description: undefined,
        public: 'false'
      });
      postReq.flush(projectSummaryResponse({ id: 'new-uuid', hash: 'h0' }));

      // Drain the microtask queue so the PUT chained after the POST is
      // actually issued before we expect it.
      await Promise.resolve();

      const putReq = httpMock.expectOne(PROJECT_URL('new-uuid'));
      expect(putReq.request.method).toBe('PUT');
      expect(putReq.request.body.elements).toEqual([]);
      expect(putReq.request.body.oldHash).toBe('h0');
      putReq.flush(projectSummaryResponse({ id: 'new-uuid', hash: 'h1' }));

      const uuid = await promise;
      expect(uuid).toBe('new-uuid');
      expect(projectService.mainProject()).toBeDefined();
      expect(
        metadataStore.getMetadata(projectService.mainProject()!)!.hash
      ).toBe('h1');
      expect(locationGo).toHaveBeenCalledWith('/project/new-uuid');
    });

    it('sends public:"true" when isPublic=true', async () => {
      const promise = service.createProject('Pub', undefined, true);

      const postReq = httpMock.expectOne(PROJECTS_LIST_URL);
      expect(postReq.request.body.public).toBe('true');
      postReq.flush(projectSummaryResponse({ id: 'pub-uuid', hash: 'h0' }));
      await Promise.resolve();

      httpMock
        .expectOne(PROJECT_URL('pub-uuid'))
        .flush(projectSummaryResponse({ id: 'pub-uuid', hash: 'h1' }));

      await promise;
    });
  });

  describe('cloneShare', () => {
    it('rejects with AuthRequiredError when /api/user returns 401', async () => {
      const promise = service.cloneShare('link-1');

      httpMock
        .expectOne(USER_URL)
        .flush(
          { status: 401, message: 'Unauthorized' },
          { status: 401, statusText: 'Unauthorized' }
        );

      await expect(promise).rejects.toEqual(expect.any(AuthRequiredError));
    });

    it('clones, loads, sets as main, and updates URL', async () => {
      const promise = service.cloneShare('link-1');

      httpMock.expectOne(USER_URL).flush({
        status: 200,
        data: { id: 'user-1', username: 'me', email: 'me@x.test' }
      });
      await Promise.resolve();

      httpMock
        .expectOne(CLONE_URL('link-1'))
        .flush(projectSummaryResponse({ id: 'cloned-uuid' }));
      // cloneShare awaits the gateway clone, then loadProjectAsMain — two
      // async hops to drain before the project GET is issued.
      await Promise.resolve();
      await Promise.resolve();

      httpMock
        .expectOne(PROJECT_URL('cloned-uuid'))
        .flush(projectDetailResponse({ id: 'cloned-uuid' }));

      await promise;
      expect(projectService.mainProject()).toBeDefined();
      expect(metadataStore.getMetadata(projectService.mainProject()!)!.id).toBe(
        'cloned-uuid'
      );
      expect(locationGo).toHaveBeenCalledWith('/project/cloned-uuid');
    });
  });

  describe('deserialization tolerance', () => {
    it('loadProject silently skips unknown component types', async () => {
      const elements: ProjectElement[] = [
        { t: 1, p: [0, 0], i: 1, o: 1 }, // NOT — known
        { t: 999, p: [5, 5] }, // unimplemented legacy type
        { t: 1, p: [10, 0], i: 1, o: 1 } // NOT — known
      ];
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const promise = service.loadProject('test-uuid');
      httpMock
        .expectOne(PROJECT_URL('test-uuid'))
        .flush(projectDetailResponse({ elements }));

      const project = await promise;
      expect(Array.from(project.components).length).toBe(2);
      // Server reads route through the v0→v1 migration, which drops unknown
      // types with a warning. LoggingService.warn forwards to
      // console.warn('[%s] %o', context, message).
      expect(warnSpy).toHaveBeenCalledWith(
        '[%s] %o',
        'v0ToV1Migration',
        expect.stringContaining('Unknown component type ID: 999')
      );
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
        hash: '',
        isPublic: false
      });

      const parsed = JSON.parse(service.exportProjectToJson(project));
      expect(parsed.version).toBe(1);
      expect(parsed.name).toBe('My Circuit');
      expect(parsed.components).toEqual([]);
      expect(parsed.wires).toEqual([]);
      expect(parsed.definitions).toEqual([]);
    });

    it('importProjectFromJson persists a clean browser project and navigates to /local/:id', async () => {
      const content = JSON.stringify({
        version: 1,
        name: 'Imported',
        components: [{ type: 1, pos: [2, 3], options: {} }],
        wires: [],
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

    it('importProjectFromJson rejects on an unreadable file (and stores nothing)', async () => {
      await expect(
        service.importProjectFromJson('{not json')
      ).rejects.toThrowError(InvalidFileError);
      expect(browserStore.records.size).toBe(0);
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
          wires: [],
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
          wires: [],
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
  });

  describe('custom component persistence (browser)', () => {
    const plugCircuit: SerializedCircuitBody = {
      components: [
        {
          type: 100,
          pos: [0, 0],
          options: { direction: 0, label: 'in', index: 0 }
        },
        {
          type: 101,
          pos: [5, 0],
          options: { direction: 0, label: 'out', index: 0 }
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
        hash: '',
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
      const instance = config.create({
        direction: config.options['direction'].clone()
      }) as CustomComponent;
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
                options: { direction: 0, label: 'in', index: 0 }
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
          { pos: [0, 0], options: { direction: 0, label: 'in', index: 0 } },
          provider.getComponent(100)!
        )
      );
      editor.addComponent(
        Component.deserialize(
          { pos: [5, 0], options: { direction: 0, label: 'out', index: 0 } },
          provider.getComponent(101)!
        )
      );
      metadataStore.register(editor, {
        id,
        name: 'Comp',
        type: 'comp',
        source: 'browser',
        hash: '',
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

    it('importProjectFromJson adopts a master-less custom into the library', async () => {
      // A file embedding one custom whose provenance master is not registered.
      const content = JSON.stringify({
        version: 1,
        name: 'Imported',
        components: [{ type: 1000, pos: [3, 3], options: { direction: 0 } }],
        wires: [],
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
            wires: []
          }
        ]
      });

      const project = await service.importProjectFromJson(content);
      expect(customInstanceOf(project).numInputs).toBe(1);

      // The custom now exists as a browser library master (palette + store).
      const records = [...componentStore.records.values()];
      expect(records.length).toBe(1);
      expect(records[0].name).toBe('Ext');
      expect(records[0].numInputs).toBe(1);
      expect(records[0].labels).toEqual(['in', 'out']);
      expect(registry.masterTypeIdForId(records[0].id)).toBeDefined();
    });
  });

  describe('custom component persistence (server)', () => {
    const COMPONENTS_URL = `${environment.apiUrl}/api/component`;
    const COMPONENT_URL = (id: string) =>
      `${environment.apiUrl}/api/component/${id}`;

    const plugCircuit: SerializedCircuitBody = {
      components: [
        {
          type: 100,
          pos: [0, 0],
          options: { direction: 0, label: 'in', index: 0 }
        },
        {
          type: 101,
          pos: [5, 0],
          options: { direction: 0, label: 'out', index: 0 }
        }
      ],
      wires: []
    };

    function componentSummaryResponse(
      o: Partial<{
        id: string;
        hash: string;
        version: number;
      }> = {}
    ) {
      return {
        status: 200,
        data: {
          id: o.id ?? 'srv-comp',
          name: 'Comp',
          description: '',
          symbol: 'C',
          numInputs: 0,
          numOutputs: 0,
          labels: [],
          createdOn: '2024-01-01',
          lastEdited: '2024-01-01',
          elementsFile: {
            hash: o.hash ?? 'h1',
            mimeType: 'application/json',
            publicUrl: ''
          },
          previewDark: null,
          previewLight: null,
          public: false,
          version: o.version
        }
      };
    }

    function customInstanceOf(project: Project): CustomComponent {
      return [...project.components].find(
        (c): c is CustomComponent => c instanceof CustomComponent
      )!;
    }

    // Snapshot a master and place an instance, mirroring snapshot-on-place.
    function placeSnapshot(project: Project, masterTypeId: number): void {
      const def = registry.snapshot(masterTypeId);
      const config = provider.getComponent(def.typeId)!;
      project.addComponent(
        config.create({ direction: config.options['direction'].clone() })
      );
    }

    it('createServerComponent POSTs, PUTs an empty initial save, registers a server master', async () => {
      const promise = service.createServerComponent({
        name: 'Comp',
        symbol: 'C',
        description: 'd'
      });

      const post = httpMock.expectOne(COMPONENTS_URL);
      expect(post.request.method).toBe('POST');
      post.flush(componentSummaryResponse({ id: 'srv-comp', hash: 'h0' }));

      // Drain microtasks so the PUT chained after the POST is issued.
      await Promise.resolve();

      const put = httpMock.expectOne(COMPONENT_URL('srv-comp'));
      expect(put.request.method).toBe('PUT');
      expect(put.request.body.elements).toEqual([]);
      expect(put.request.body.numInputs).toBe(0);
      expect(put.request.body.labels).toEqual([]);
      put.flush(componentSummaryResponse({ id: 'srv-comp', hash: 'h1' }));

      const { project, masterTypeId } = await promise;
      const meta = metadataStore.getMetadata(project)!;
      expect(meta.type).toBe('comp');
      expect(meta.source).toBe('server');
      expect(meta.hash).toBe('h1');
      expect(registry.masterTypeIdForId('srv-comp')).toBe(masterTypeId);
    });

    it('loadServerComponent revives the embedded snapshot — ports come from it (Inv. A)', async () => {
      const promise = service.loadServerComponent('host-comp');

      const get = httpMock.expectOne(COMPONENT_URL('host-comp'));
      expect(get.request.method).toBe('GET');
      get.flush({
        status: 200,
        data: {
          id: 'host-comp',
          name: 'Host',
          description: '',
          symbol: 'H',
          numInputs: 0,
          numOutputs: 0,
          labels: [],
          createdOn: '2024-01-01',
          lastEdited: '2024-01-01',
          elementsFile: {
            hash: 'gh',
            mimeType: 'application/json',
            publicUrl: ''
          },
          previewDark: null,
          previewLight: null,
          public: false,
          version: 4,
          elements: [{ t: 1000, p: [3, 3], i: 9, o: 9 }],
          dependencies: [
            {
              dependency: { id: 'dep-master', version: 6 },
              model: 1000,
              snapshot: {
                version: 4,
                name: 'Dep',
                symbol: 'D',
                description: '',
                numInputs: 1,
                numOutputs: 1,
                labels: ['in', 'out'],
                elements: [
                  { t: 100, p: [0, 0], o: 1, n: [0], s: 'in' },
                  { t: 101, p: [5, 0], i: 1, n: [0], s: 'out' }
                ]
              }
            }
          ]
        }
      });

      const { project, masterTypeId } = await promise;
      const instance = customInstanceOf(project);
      // Counts come from the snapshot, not the body element's bogus i/o.
      expect(instance.numInputs).toBe(1);
      expect(instance.numOutputs).toBe(1);
      expect(metadataStore.getMetadata(project)!.source).toBe('server');
      expect(registry.masterTypeIdForId('host-comp')).toBe(masterTypeId);
    });

    it('server project save embeds dependencies[].snapshot plus legacy { id, model }', async () => {
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
        id: 'proj-1',
        name: 'P',
        type: 'project',
        source: 'server',
        hash: 'ph',
        isPublic: false
      });
      placeSnapshot(project, master);
      metadataStore.markDirty(project);

      const promise = service.saveProject(project);
      const put = httpMock.expectOne(PROJECT_URL('proj-1'));
      expect(put.request.method).toBe('PUT');
      const dep = put.request.body.dependencies[0];
      expect(dep.id).toBe('pm1');
      expect(dep.model).toBe(1000);
      expect(dep.snapshot.version).toBe(3);
      expect(dep.snapshot.numInputs).toBe(1);
      expect(dep.snapshot.labels).toEqual(['in', 'out']);
      expect(dep.snapshot.elements.length).toBeGreaterThan(0);
      put.flush(projectSummaryResponse({ id: 'proj-1', hash: 'ph2' }));

      await promise;
      expect(metadataStore.isDirty(project)).toBe(false);
    });

    it('server component save sends the recomputed summary and adopts the returned version', async () => {
      const masterType = registry.createMaster(
        { id: 'ec1', version: 2, symbol: 'E' },
        'server'
      );
      const editor = new Project();
      metadataStore.register(editor, {
        id: 'ec1',
        name: 'E',
        type: 'comp',
        source: 'server',
        hash: 'eh',
        isPublic: false
      });
      editor.addComponent(
        Component.deserialize(
          { pos: [0, 0], options: { direction: 0, label: 'in', index: 0 } },
          provider.getComponent(100)!
        )
      );
      metadataStore.markDirty(editor);

      const promise = service.saveProject(editor);
      const put = httpMock.expectOne(COMPONENT_URL('ec1'));
      expect(put.request.method).toBe('PUT');
      expect(put.request.body.numInputs).toBe(1);
      expect(put.request.body.labels).toEqual(['in']);
      put.flush(
        componentSummaryResponse({ id: 'ec1', hash: 'eh2', version: 7 })
      );

      await promise;
      // The server's save-time version stamp is adopted onto the master.
      expect(registry.getDefinition(masterType)!.version).toBe(7);
      expect(metadataStore.isDirty(editor)).toBe(false);
    });
  });
});
