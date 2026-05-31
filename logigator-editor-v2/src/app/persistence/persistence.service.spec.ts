import { Injector } from '@angular/core';
import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import {
	provideHttpClient,
	withInterceptorsFromDi
} from '@angular/common/http';
import {
	HttpTestingController,
	provideHttpClientTesting
} from '@angular/common/http/testing';
import { TranslocoService } from '@jsverse/transloco';
import { MessageService } from 'primeng/api';
import { AuthRequiredError, PersistenceService } from './persistence.service';
import { ProjectMetadataStore } from './project-metadata.store';
import { ProjectService } from '../project/project.service';
import { Project } from '../project/project';
import { ProjectElement } from '../api/models/project-element';
import { setStaticDIInjector } from '../utils/get-di';
import { environment } from '../../environments/environment';
import { InvalidFileError } from './file/circuit-file.errors';
import { BrowserProjectStore } from './browser/browser-project.store';
import { StoredBrowserProject } from './browser/browser-project.types';

/**
 * In-memory stand-in for the IndexedDB store, so PersistenceService orchestration
 * (import persists, save dispatches, local load reads) is tested deterministically.
 * The real store is covered by browser-project.store.spec.ts.
 */
class FakeBrowserProjectStore {
	readonly records = new Map<string, StoredBrowserProject>();
	private _counter = 0;

	async save(params: {
		id?: string;
		name: string;
		content: string;
	}): Promise<StoredBrowserProject> {
		const id = params.id ?? `browser-id-${++this._counter}`;
		const existing = params.id ? this.records.get(params.id) : undefined;
		const now = 1000 + ++this._counter;
		const record: StoredBrowserProject = {
			id,
			name: params.name,
			type: 'project',
			createdOn: existing?.createdOn ?? now,
			lastEdited: now,
			content: params.content
		};
		this.records.set(id, record);
		return record;
	}

	async get(id: string): Promise<StoredBrowserProject | undefined> {
		return this.records.get(id);
	}

	async list() {
		return [...this.records.values()].map(
			({ id, name, createdOn, lastEdited }) => ({
				id,
				name,
				createdOn,
				lastEdited
			})
		);
	}

	async delete(id: string): Promise<void> {
		this.records.delete(id);
	}
}

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
	overrides: Partial<{ id: string; name: string; hash: string }> = {}
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
	let locationGo: jasmine.Spy;
	let browserStore: FakeBrowserProjectStore;

	beforeEach(() => {
		locationGo = jasmine.createSpy('Location.go');
		browserStore = new FakeBrowserProjectStore();
		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(withInterceptorsFromDi()),
				provideHttpClientTesting(),
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
					MessageService,
					{ provide: TranslocoService, useValue: jasmine.createSpyObj('TranslocoService', ['translate']) }
			]
		});
		setStaticDIInjector(TestBed.inject(Injector));
		service = TestBed.inject(PersistenceService);
		metadataStore = TestBed.inject(ProjectMetadataStore);
		projectService = TestBed.inject(ProjectService);
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
			expect(metadataStore.isDirty(project)).toBeFalse();
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
			expect(metadataStore.isDirty(project)).toBeTrue();
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
			expect(metadataStore.isDirty(project)).toBeFalse();
		});

		it('promotes a fresh browser draft: generates an id and updates the URL', async () => {
			const project = service.createAndSetEmptyProject();
			metadataStore.markDirty(project);

			await service.saveProject(project);

			const id = metadataStore.getMetadata(project)!.id;
			expect(id).toBeTruthy();
			expect(browserStore.records.has(id)).toBeTrue();
			expect(locationGo).toHaveBeenCalledWith(`/local/${id}`);
			expect(metadataStore.isDirty(project)).toBeFalse();
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
			expect(metadataStore.isDirty(project)).toBeFalse();
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

			await expectAsync(promise).toBeRejected();
			expect(metadataStore.getMetadata(project)!.hash).toBe('stale-hash');
			expect(metadataStore.isDirty(project)).toBeTrue();
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
			expect(metadataStore.isDirty(project)).toBeTrue();
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
			expect(metadataStore.isDirty(project)).toBeFalse();
			expect(Array.from(project.components).length).toBe(1);
		});

		it('rejects when the API returns 404', async () => {
			const loadPromise = service.loadProject('missing');
			const req = httpMock.expectOne(PROJECT_URL('missing'));
			req.flush(
				{ status: 404, message: 'NotFound' },
				{ status: 404, statusText: 'Not Found' }
			);
			await expectAsync(loadPromise).toBeRejected();
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
			expect(metadataStore.isDirty(project)).toBeFalse();
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

			await expectAsync(promise).toBeRejectedWith(
				jasmine.any(AuthRequiredError)
			);
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
				{ t: 100, p: [5, 5] }, // INPUT — not implemented in v2 yet
				{ t: 1, p: [10, 0], i: 1, o: 1 } // NOT — known
			];
			const warnSpy = spyOn(console, 'warn');

			const promise = service.loadProject('test-uuid');
			httpMock
				.expectOne(PROJECT_URL('test-uuid'))
				.flush(projectDetailResponse({ elements }));

			const project = await promise;
			expect(Array.from(project.components).length).toBe(2);
			// LoggingService.warn forwards to console.warn('[%s] %o', context, message).
			expect(warnSpy).toHaveBeenCalledWith(
				'[%s] %o',
				'CircuitSerializer',
				jasmine.stringContaining('Unknown component type ID: 100')
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
		});

		it('importProjectFromJson persists a clean browser project and navigates to /local/:id', async () => {
			const content = JSON.stringify({
				version: 1,
				name: 'Imported',
				components: [{ type: 1, pos: [2, 3], options: {} }],
				wires: []
			});

			const project = await service.importProjectFromJson(content);
			const metadata = metadataStore.getMetadata(project);

			expect(projectService.mainProject()).toBe(project);
			expect(metadata!.source).toBe('browser');
			expect(metadata!.id).toBeTruthy();
			expect(metadata!.name).toBe('Imported');
			expect(metadataStore.isDirty(project)).toBeFalse();
			expect(Array.from(project.components).length).toBe(1);

			// Persisted immediately, and the URL reflects the new id.
			expect(browserStore.records.has(metadata!.id)).toBeTrue();
			expect(locationGo).toHaveBeenCalledWith(`/local/${metadata!.id}`);
		});

		it('importProjectFromJson rejects on an unreadable file (and stores nothing)', async () => {
			await expectAsync(
				service.importProjectFromJson('{not json')
			).toBeRejectedWithError(InvalidFileError);
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
					wires: []
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
			await expectAsync(service.loadLocalProject('nope')).toBeRejected();
		});

		it('loadLocalProjectAsMain sets the project as main and updates the URL', async () => {
			const record = await browserStore.save({
				name: 'Stored',
				content: JSON.stringify({
					version: 1,
					name: 'Stored',
					components: [],
					wires: []
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
});
