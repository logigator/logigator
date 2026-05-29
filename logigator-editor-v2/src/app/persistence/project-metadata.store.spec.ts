import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ProjectMetadataStore, ProjectMetadata } from './project-metadata.store';
import { Project } from '../project/project';
import { setStaticDIInjector } from '../utils/get-di';

function makeMetadata(
	overrides: Partial<ProjectMetadata> = {}
): ProjectMetadata {
	return {
		serverUuid: 'uuid-1',
		name: 'Test',
		type: 'project',
		source: 'server',
		hash: 'hash-1',
		isPublic: false,
		...overrides
	};
}

// Tests work against the real Project class (it touches PixiJS and the DI
// container at construction time, so we use TestBed to bootstrap statics).
describe('ProjectMetadataStore', () => {
	let store: ProjectMetadataStore;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		setStaticDIInjector(TestBed.inject(Injector));
		store = TestBed.inject(ProjectMetadataStore);
	});

	describe('register / getMetadata', () => {
		it('stores and retrieves metadata by project', () => {
			const project = new Project();
			const meta = makeMetadata({ name: 'Alpha' });
			store.register(project, meta);

			expect(store.getMetadata(project)).toEqual(meta);
		});

		it('returns undefined for unknown project', () => {
			const project = new Project();
			expect(store.getMetadata(project)).toBeUndefined();
		});
	});

	describe('getHandleByUuid', () => {
		it('finds a registered project by serverUuid', () => {
			const project = new Project();
			store.register(project, makeMetadata({ serverUuid: 'abc' }));

			const handle = store.getHandleByUuid('abc');
			expect(handle).toBeDefined();
			expect(handle!.project).toBe(project);
			expect(handle!.metadata.serverUuid).toBe('abc');
		});

		it('returns undefined when no match', () => {
			expect(store.getHandleByUuid('missing')).toBeUndefined();
		});
	});

	describe('remove', () => {
		it('drops metadata and unsubscribes from actionChange$', () => {
			const project = new Project();
			store.register(project, makeMetadata());

			expect(store.getMetadata(project)).toBeDefined();

			store.remove(project);
			expect(store.getMetadata(project)).toBeUndefined();

			// After removal, action changes must not re-mark the project dirty.
			// We can't fire actionChange$ directly without ActionManager state,
			// but isDirty stays false because the entry is gone.
			expect(store.isDirty(project)).toBeFalse();
		});

		it('is a no-op on unknown projects', () => {
			const project = new Project();
			expect(() => store.remove(project)).not.toThrow();
		});
	});

	describe('dirty tracking', () => {
		it('starts clean after register', () => {
			const project = new Project();
			store.register(project, makeMetadata());
			expect(store.isDirty(project)).toBeFalse();
		});

		it('markDirty marks the project dirty', () => {
			const project = new Project();
			store.register(project, makeMetadata());

			store.markDirty(project);

			expect(store.isDirty(project)).toBeTrue();
		});

		it('markDirty is idempotent on the flag', () => {
			const project = new Project();
			store.register(project, makeMetadata());

			store.markDirty(project);
			store.markDirty(project);
			store.markDirty(project);

			expect(store.isDirty(project)).toBeTrue();
		});

		it('clearDirty clears the dirty flag', () => {
			const project = new Project();
			store.register(project, makeMetadata());
			store.markDirty(project);

			store.clearDirty(project);

			expect(store.isDirty(project)).toBeFalse();
		});

		it('clearDirty on already-clean project is a no-op', () => {
			const project = new Project();
			store.register(project, makeMetadata());

			expect(() => store.clearDirty(project)).not.toThrow();
			expect(store.isDirty(project)).toBeFalse();
		});

		it('markDirty / clearDirty on unknown project is a no-op', () => {
			const project = new Project();

			expect(() => store.markDirty(project)).not.toThrow();
			expect(() => store.clearDirty(project)).not.toThrow();
		});
	});

	describe('dirtyVersion', () => {
		it('returns 0 before any dirty marking', () => {
			const project = new Project();
			store.register(project, makeMetadata());
			expect(store.dirtyVersion(project)).toBe(0);
		});

		it('increments on every markDirty (even when already dirty)', () => {
			const project = new Project();
			store.register(project, makeMetadata());

			store.markDirty(project);
			const v1 = store.dirtyVersion(project);

			store.markDirty(project);
			const v2 = store.dirtyVersion(project);

			store.markDirty(project);
			const v3 = store.dirtyVersion(project);

			expect(v1).toBe(1);
			expect(v2).toBe(2);
			expect(v3).toBe(3);
		});

		it('does not reset on clearDirty (so save-race detection still works)', () => {
			const project = new Project();
			store.register(project, makeMetadata());

			store.markDirty(project);
			store.markDirty(project);
			store.clearDirty(project);

			expect(store.dirtyVersion(project)).toBe(2);
		});
	});

	describe('updateHash', () => {
		it('updates the hash on existing metadata', () => {
			const project = new Project();
			store.register(project, makeMetadata({ hash: 'old' }));
			store.updateHash(project, 'new');
			expect(store.getMetadata(project)!.hash).toBe('new');
		});

		it('is a no-op for unknown project', () => {
			const project = new Project();
			expect(() => store.updateHash(project, 'x')).not.toThrow();
		});
	});

	describe('actionChange subscription', () => {
		it('marks project dirty when actionManager.actionChange$ fires', () => {
			const project = new Project();
			store.register(project, makeMetadata());

			expect(store.isDirty(project)).toBeFalse();

			// actionChange$ is an Observable<void> exposed from a Subject inside
			// ActionManager. Trigger a real action push so the chain wires up.
			// Using the underlying subject directly via type assertion keeps the
			// test focused on the metadata store's reaction.
			const subject = (
				project.actionManager as unknown as { _actionChange$: Subject<void> }
			)._actionChange$;
			subject.next();

			expect(store.isDirty(project)).toBeTrue();
		});

		it('does not subscribe when trackDirty=false (read-only shares)', () => {
			const project = new Project();
			store.register(project, makeMetadata({ source: 'share' }), false);

			const subject = (
				project.actionManager as unknown as { _actionChange$: Subject<void> }
			)._actionChange$;
			subject.next();

			expect(store.isDirty(project)).toBeFalse();
		});

		it('unsubscribes on remove (subsequent action changes do not mark dirty)', () => {
			const project = new Project();
			store.register(project, makeMetadata());
			store.remove(project);

			// Re-register without dirty tracking so we can observe the flag
			// without re-subscribing.
			store.register(project, makeMetadata(), false);

			const subject = (
				project.actionManager as unknown as { _actionChange$: Subject<void> }
			)._actionChange$;
			subject.next();

			expect(store.isDirty(project)).toBeFalse();
		});
	});
});
