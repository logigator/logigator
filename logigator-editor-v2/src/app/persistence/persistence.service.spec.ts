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
import {
	AuthRequiredError,
	PersistenceService
} from './persistence.service';
import { ProjectMetadataStore } from './project-metadata.store';
import { ProjectService } from '../project/project.service';
import { Project } from '../project/project';
import { ProjectElement } from '../api/models/project-element';
import { setStaticDIInjector } from '../utils/get-di';
import { environment } from '../../environments/environment';
import { InvalidFileError } from './file/circuit-file.errors';

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

	beforeEach(() => {
		locationGo = jasmine.createSpy('Location.go');
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
				}
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
		it('creates a local project, sets as main, and registers metadata', () => {
			const project = service.createAndSetEmptyProject();
			const metadata = metadataStore.getMetadata(project);

			expect(metadata).toBeDefined();
			expect(metadata!.source).toBe('local');
			expect(metadata!.serverUuid).toBe('');
			expect(metadata!.name).toBe('Untitled');
			expect(metadataStore.isDirty(project)).toBeFalse();
			expect(projectService.mainProject()).toBe(project);
		});
	});

	describe('saveProject', () => {
		it('returns null for non-dirty projects (no HTTP call)', async () => {
			const project = new Project();
			metadataStore.register(project, {
				serverUuid: 'test-uuid',
				name: 'Test',
				type: 'project',
				source: 'server',
				hash: 'abc123',
				isPublic: false
			});

			const result = await service.saveProject(project);
			expect(result).toBeNull();
			// httpMock.verify() in afterEach will fail if a request was made
		});

		it('returns null for local projects without throwing', async () => {
			const project = new Project();
			metadataStore.register(project, {
				serverUuid: '',
				name: 'Local',
				type: 'project',
				source: 'local',
				hash: '',
				isPublic: false
			});
			metadataStore.markDirty(project);

			const result = await service.saveProject(project);
			expect(result).toBeNull();
			expect(metadataStore.isDirty(project)).toBeTrue();
		});

		it('PUTs elements, updates hash, and clears dirty on success', async () => {
			const project = new Project();
			metadataStore.register(project, {
				serverUuid: 'test-uuid',
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

			const result = await promise;
			expect(result!.elementsFile!.hash).toBe('new-hash');
			expect(metadataStore.getMetadata(project)!.hash).toBe('new-hash');
			expect(metadataStore.isDirty(project)).toBeFalse();
		});

		it('deduplicates concurrent saves and both callers see the same result', async () => {
			const project = new Project();
			metadataStore.register(project, {
				serverUuid: 'test-uuid',
				name: 'Test',
				type: 'project',
				source: 'server',
				hash: 'abc123',
				isPublic: false
			});
			metadataStore.markDirty(project);

			const promise1 = service.saveProject(project);
			const promise2 = service.saveProject(project);

			const req = httpMock.expectOne(PROJECT_URL('test-uuid'));
			req.flush(projectSummaryResponse({ hash: 'new-hash' }));

			const [r1, r2] = await Promise.all([promise1, promise2]);
			expect(r1).toBe(r2);
			expect(r1!.elementsFile!.hash).toBe('new-hash');
		});

		it('on VersionMismatch: rejects, leaves hash unchanged and dirty true', async () => {
			const project = new Project();
			metadataStore.register(project, {
				serverUuid: 'test-uuid',
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
				serverUuid: 'test-uuid',
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
			expect(metadata!.serverUuid).toBe('test-uuid');
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
			expect(metadataStore.getMetadata(projectService.mainProject()!)?.serverUuid).toBe(
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
			expect(metadataStore.getMetadata(main!)?.source).toBe('local');
			expect(locationGo).not.toHaveBeenCalled();
		});

		it('stale loads are discarded with full cleanup (no metadata leak)', async () => {
			// Start load A
			const promiseA = service.loadProjectAsMain('uuid-a');

			// Before A resolves, start load B — bumps the token
			const promiseB = service.loadProjectAsMain('uuid-b');

			// Resolve B first
			httpMock.expectOne(PROJECT_URL('uuid-b'))
				.flush(projectDetailResponse({ id: 'uuid-b' }));

			// Now resolve A — this is stale; the project must be disposed and
			// its metadata removed from the store.
			httpMock.expectOne(PROJECT_URL('uuid-a'))
				.flush(projectDetailResponse({ id: 'uuid-a' }));

			await Promise.all([promiseA, promiseB]);

			// Only B's project should be in the metadata store
			const handle = metadataStore.getHandleByUuid('uuid-a');
			expect(handle).toBeUndefined();
			expect(metadataStore.getHandleByUuid('uuid-b')).toBeDefined();
			expect(projectService.mainProject()).toBe(
				metadataStore.getHandleByUuid('uuid-b')!.project
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

			httpMock.expectOne(SHARE_URL('link-1'))
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

			httpMock.expectOne(SHARE_URL('link-comp'))
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
			expect(metadataStore.getMetadata(projectService.mainProject()!)!.hash).toBe(
				'h1'
			);
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

			httpMock.expectOne(USER_URL).flush(
				{ status: 401, message: 'Unauthorized' },
				{ status: 401, statusText: 'Unauthorized' }
			);

			await expectAsync(promise).toBeRejectedWith(jasmine.any(AuthRequiredError));
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
			expect(
				metadataStore.getMetadata(projectService.mainProject()!)!.serverUuid
			).toBe('cloned-uuid');
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
		it('exportProjectToJson emits the current version and metadata name', () => {
			const project = new Project();
			metadataStore.register(project, {
				serverUuid: '',
				name: 'My Circuit',
				type: 'project',
				source: 'local',
				hash: '',
				isPublic: false
			});

			const parsed = JSON.parse(service.exportProjectToJson(project));
			expect(parsed.version).toBe(1);
			expect(parsed.name).toBe('My Circuit');
			expect(parsed.components).toEqual([]);
			expect(parsed.wires).toEqual([]);
		});

		it('importProjectFromJson sets a clean local main project from file content', () => {
			const content = JSON.stringify({
				version: 1,
				name: 'Imported',
				components: [{ type: 1, pos: [2, 3], options: {} }],
				wires: []
			});

			const project = service.importProjectFromJson(content);
			const metadata = metadataStore.getMetadata(project);

			expect(projectService.mainProject()).toBe(project);
			expect(metadata!.source).toBe('local');
			expect(metadata!.serverUuid).toBe('');
			expect(metadata!.name).toBe('Imported');
			expect(metadataStore.isDirty(project)).toBeFalse();
			expect(Array.from(project.components).length).toBe(1);
			expect(locationGo).not.toHaveBeenCalled();
		});

		it('importProjectFromJson throws on an unreadable file', () => {
			expect(() => service.importProjectFromJson('{not json')).toThrowError(
				InvalidFileError
			);
		});
	});
});
