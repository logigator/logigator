import { computed, Injectable, signal, WritableSignal } from '@angular/core';
import { Subscription } from 'rxjs';
import { SignalMap } from 'ngxtension/collections';
import { Project } from '../project/project';

export interface ProjectMetadata {
  /**
   * The project's id within its store: the server uuid for `'server'`/`'share'`
   * projects, the generated IndexedDB id for `'browser'` projects, or `''` for a
   * browser project that has not been written to storage yet.
   */
  id: string;
  name: string;
  type: 'project' | 'comp';
  source: 'server' | 'browser' | 'share';
  hash: string;
  isPublic: boolean;
  link?: string;
}

interface ProjectEntry {
  metadata: ProjectMetadata;
  dirty: WritableSignal<boolean>;
  /** Monotonic counter incremented on every markDirty call (even when already dirty). */
  dirtyVersion: number;
  /** Epoch-ms of the most recent markDirty; absent until the first local edit. */
  lastEditedAt?: number;
  actionSub?: Subscription;
}

@Injectable({ providedIn: 'root' })
export class ProjectMetadataStore {
  private readonly _entries = new SignalMap<Project, ProjectEntry>();

  public readonly anyDirty = computed(() => {
    for (const entry of this._entries.values()) {
      if (entry.dirty()) return true;
    }
    return false;
  });

  /**
   * Registers a project with its metadata.
   *
   * When `trackDirty` is true (the default), the store subscribes to the
   * project's `actionManager.actionChange$` and marks the project dirty on
   * every state change. Shared (read-only) projects can opt out by passing
   * `false`. Either way, `remove()` will tear the subscription down.
   */
  public register(
    project: Project,
    metadata: ProjectMetadata,
    trackDirty = true
  ): void {
    const entry: ProjectEntry = {
      metadata,
      dirty: signal(false),
      dirtyVersion: 0
    };
    if (trackDirty) {
      entry.actionSub = project.actionManager.actionChange$.subscribe(() => {
        this.markDirty(project);
      });
    }
    this._entries.set(project, entry);
  }

  public getMetadata(project: Project): ProjectMetadata | undefined {
    return this._entries.get(project)?.metadata;
  }

  /**
   * All registered projects with their metadata. Reactive: reading it inside a
   * computed/effect tracks registrations and removals (the map is a SignalMap),
   * so session-level consumers (owner stamping, logout teardown) observe
   * documents appearing and disappearing.
   */
  public getAllHandles(): { project: Project; metadata: ProjectMetadata }[] {
    return Array.from(this._entries, ([project, entry]) => ({
      project,
      metadata: entry.metadata
    }));
  }

  public getHandleById(
    id: string
  ): { project: Project; metadata: ProjectMetadata } | undefined {
    for (const [project, entry] of this._entries) {
      if (entry.metadata.id === id) {
        return { project, metadata: entry.metadata };
      }
    }
    return undefined;
  }

  public remove(project: Project): void {
    const entry = this._entries.get(project);
    if (!entry) return;
    entry.actionSub?.unsubscribe();
    this._entries.delete(project);
  }

  public markDirty(project: Project): void {
    const entry = this._entries.get(project);
    if (!entry) return;
    entry.dirtyVersion++;
    entry.lastEditedAt = Date.now();
    entry.dirty.set(true);
  }

  /**
   * Epoch-ms of the project's most recent local edit (its last `markDirty`), or
   * `undefined` if it has not been edited this session. A one-shot snapshot,
   * not reactive — the logout confirmation reads it once when it opens.
   */
  public lastEditedAt(project: Project): number | undefined {
    return this._entries.get(project)?.lastEditedAt;
  }

  public clearDirty(project: Project): void {
    const entry = this._entries.get(project);
    if (!entry) return;
    entry.dirty.set(false);
  }

  public isDirty(project: Project): boolean {
    return this._entries.get(project)?.dirty() ?? false;
  }

  /**
   * Returns a token that changes on every `markDirty` call. Callers (e.g. the
   * save flow) capture it before async work and compare on completion to
   * detect concurrent edits.
   */
  public dirtyVersion(project: Project): number {
    return this._entries.get(project)?.dirtyVersion ?? 0;
  }

  /**
   * Runs an async save step under the mid-save edit guard: snapshots
   * {@link dirtyVersion} before `fn` runs (so `fn` must include the
   * serialization, not just the write), and clears the dirty flag afterwards
   * only when no edit landed while `fn` was in flight — a save must not mark
   * newer, unsaved edits as saved. An error from `fn` propagates with the
   * flag untouched.
   */
  public async withDirtyGuard<T>(
    project: Project,
    fn: () => Promise<T>
  ): Promise<T> {
    const versionAtSnapshot = this.dirtyVersion(project);
    const result = await fn();
    if (this.dirtyVersion(project) === versionAtSnapshot) {
      this.clearDirty(project);
    }
    return result;
  }

  public updateHash(project: Project, hash: string): void {
    this.update(project, { hash });
  }

  /**
   * Sets the store id after a project is first written to its backing store
   * (e.g. a fresh browser project promoted into IndexedDB on its first save).
   * Re-`set`s the map entry rather than mutating in place, so reactive readers
   * (the title-bar source chip, the File-menu upload item) observe a draft
   * gaining its store id.
   */
  public updateId(project: Project, id: string): void {
    this.update(project, { id });
  }

  /**
   * Merges `patch` into a project's metadata by re-`set`ting the map entry, so
   * reactive readers observe the change (e.g. flipping `source`/`id`/`isPublic`
   * when a draft is promoted to the server, or applying a chosen name).
   */
  public update(project: Project, patch: Partial<ProjectMetadata>): void {
    const entry = this._entries.get(project);
    if (!entry) return;
    this._entries.set(project, {
      ...entry,
      metadata: { ...entry.metadata, ...patch }
    });
  }
}
