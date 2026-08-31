import { beforeEach, describe, expect, it } from 'vitest';
import { computed } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import {
  ProjectMetadata,
  ProjectMetadataStore
} from './project-metadata.store';
import { Project } from '../project/project';
import { configureTestBed } from '../../testing/configure-test-bed';

function makeMetadata(
  overrides: Partial<ProjectMetadata> = {}
): ProjectMetadata {
  return {
    id: 'uuid-1',
    name: 'Test',
    type: 'project',
    source: 'server',
    version: 1,
    isPublic: false,
    ...overrides
  };
}

// The real Project class touches PixiJS and the DI container at construction,
// hence TestBed to bootstrap the statics.
describe('ProjectMetadataStore', () => {
  let store: ProjectMetadataStore;

  beforeEach(() => {
    configureTestBed();
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

  describe('getHandleById', () => {
    it('finds a registered project by id', () => {
      const project = new Project();
      store.register(project, makeMetadata({ id: 'abc' }));

      const handle = store.getHandleById('abc');
      expect(handle).toBeDefined();
      expect(handle!.project).toBe(project);
      expect(handle!.metadata.id).toBe('abc');
    });

    it('returns undefined when no match', () => {
      expect(store.getHandleById('missing')).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('drops metadata and unsubscribes from actionChange$', () => {
      const project = new Project();
      store.register(project, makeMetadata());

      expect(store.getMetadata(project)).toBeDefined();

      store.remove(project);
      expect(store.getMetadata(project)).toBeUndefined();

      // The entry is gone, so an action change cannot re-mark it dirty.
      expect(store.isDirty(project)).toBe(false);
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
      expect(store.isDirty(project)).toBe(false);
    });

    it('markDirty marks the project dirty', () => {
      const project = new Project();
      store.register(project, makeMetadata());

      store.markDirty(project);

      expect(store.isDirty(project)).toBe(true);
    });

    it('clearDirty clears the dirty flag', () => {
      const project = new Project();
      store.register(project, makeMetadata());
      store.markDirty(project);

      store.clearDirty(project);

      expect(store.isDirty(project)).toBe(false);
    });

    it('clearDirty on already-clean project is a no-op', () => {
      const project = new Project();
      store.register(project, makeMetadata());

      expect(() => store.clearDirty(project)).not.toThrow();
      expect(store.isDirty(project)).toBe(false);
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

  describe('updateVersion', () => {
    it('updates the version on existing metadata', () => {
      const project = new Project();
      store.register(project, makeMetadata({ version: 1 }));
      store.updateVersion(project, 2);
      expect(store.getMetadata(project)!.version).toBe(2);
    });

    it('is a no-op for unknown project', () => {
      const project = new Project();
      expect(() => store.updateVersion(project, 2)).not.toThrow();
    });
  });

  describe('updateId', () => {
    it('updates the id on existing metadata', () => {
      const project = new Project();
      store.register(project, makeMetadata({ id: '' }));
      store.updateId(project, 'generated-id');
      expect(store.getMetadata(project)!.id).toBe('generated-id');
    });

    it('notifies reactive readers when a draft gains its store id', () => {
      const project = new Project();
      store.register(project, makeMetadata({ id: '' }));
      const id = computed(() => store.getMetadata(project)?.id);

      expect(id()).toBe('');
      store.updateId(project, 'generated-id');
      // The entry is re-`set` rather than mutated, so computed readers of the
      // id re-resolve after a draft's first local save.
      expect(id()).toBe('generated-id');
    });

    it('is a no-op for unknown project', () => {
      const project = new Project();
      expect(() => store.updateId(project, 'x')).not.toThrow();
    });
  });

  describe('update', () => {
    it('merges the patch into existing metadata', () => {
      const project = new Project();
      store.register(project, makeMetadata({ name: 'Untitled', id: '' }));

      store.update(project, { name: 'Renamed', source: 'browser', id: 'x' });

      const meta = store.getMetadata(project)!;
      expect(meta.name).toBe('Renamed');
      expect(meta.source).toBe('browser');
      expect(meta.id).toBe('x');
      expect(meta.type).toBe('project');
    });

    it('preserves dirty state and dirty version across the re-set', () => {
      const project = new Project();
      store.register(project, makeMetadata());
      store.markDirty(project);
      const version = store.dirtyVersion(project);

      store.update(project, { name: 'Renamed' });

      expect(store.isDirty(project)).toBe(true);
      expect(store.dirtyVersion(project)).toBe(version);
    });

    it('notifies reactive readers of the change', () => {
      const project = new Project();
      store.register(project, makeMetadata({ name: 'Untitled' }));
      const name = computed(() => store.getMetadata(project)?.name);

      expect(name()).toBe('Untitled');
      store.update(project, { name: 'Renamed' });
      expect(name()).toBe('Renamed');
    });

    it('is a no-op for unknown project', () => {
      const project = new Project();
      expect(() => store.update(project, { name: 'x' })).not.toThrow();
    });
  });

  describe('actionChange subscription', () => {
    it('marks project dirty when actionManager.actionChange$ fires', () => {
      const project = new Project();
      store.register(project, makeMetadata());

      expect(store.isDirty(project)).toBe(false);

      // A real action push, so the actionChange$ chain wires up.
      const subject = (
        project.actionManager as unknown as {
          _actionChange$: Subject<void>;
        }
      )._actionChange$;
      subject.next();

      expect(store.isDirty(project)).toBe(true);
    });

    it('does not subscribe when trackDirty=false (read-only shares)', () => {
      const project = new Project();
      store.register(project, makeMetadata({ source: 'share' }), false);

      const subject = (
        project.actionManager as unknown as {
          _actionChange$: Subject<void>;
        }
      )._actionChange$;
      subject.next();

      expect(store.isDirty(project)).toBe(false);
    });

    it('unsubscribes on remove (subsequent action changes do not mark dirty)', () => {
      const project = new Project();
      store.register(project, makeMetadata());
      store.remove(project);

      // Re-registered without dirty tracking, so the flag stays observable.
      store.register(project, makeMetadata(), false);

      const subject = (
        project.actionManager as unknown as {
          _actionChange$: Subject<void>;
        }
      )._actionChange$;
      subject.next();

      expect(store.isDirty(project)).toBe(false);
    });
  });

  describe('anyDirty', () => {
    it('is false when no projects are registered', () => {
      expect(store.anyDirty()).toBe(false);
    });

    it('starts false after registering a clean project', () => {
      const project = new Project();
      store.register(project, makeMetadata());
      expect(store.anyDirty()).toBe(false);
    });

    it('becomes true when a project is marked dirty', () => {
      const project = new Project();
      store.register(project, makeMetadata());
      store.markDirty(project);
      expect(store.anyDirty()).toBe(true);
    });

    it('returns to false when the last dirty project is cleaned', () => {
      const project = new Project();
      store.register(project, makeMetadata());
      store.markDirty(project);
      store.clearDirty(project);
      expect(store.anyDirty()).toBe(false);
    });

    it('reacts to a project registered after the computed was first read', () => {
      expect(store.anyDirty()).toBe(false);

      const project = new Project();
      store.register(project, makeMetadata());
      store.markDirty(project);

      expect(store.anyDirty()).toBe(true);
    });

    it('stops tracking a removed project', () => {
      const project = new Project();
      store.register(project, makeMetadata());
      store.markDirty(project);
      expect(store.anyDirty()).toBe(true);

      store.remove(project);
      expect(store.anyDirty()).toBe(false);
    });

    it('is true when one of multiple projects is dirty', () => {
      const p1 = new Project();
      const p2 = new Project();
      store.register(p1, makeMetadata({ id: 'a' }));
      store.register(p2, makeMetadata({ id: 'b' }));

      store.markDirty(p2);
      expect(store.anyDirty()).toBe(true);

      store.clearDirty(p2);
      expect(store.anyDirty()).toBe(false);
    });
  });
});
