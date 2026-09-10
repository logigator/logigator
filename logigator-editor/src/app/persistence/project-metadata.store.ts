import { computed, Injectable, signal, WritableSignal } from '@angular/core';
import { Subscription } from 'rxjs';
import { SignalMap } from 'ngxtension/collections';
import { Project } from '../project/project';
import type { FileForkAttributionV1 } from '@logigator/core';

export interface ProjectMetadata {
  /**
   * The project's id within its store: the server uuid, the generated IndexedDB
   * id, or `''` for a browser project not yet written to storage.
   */
  id: string;
  name: string;
  type: 'project' | 'comp';
  source: 'server' | 'browser' | 'share';
  /**
   * The cloud document's optimistic-concurrency counter, as the last read or
   * write left it: a save presents it and the server answers `version_conflict`
   * if anything moved in between. Server documents only — a browser record is
   * the one writer of its own blob, and a share is read-only. The server owns
   * the counter, so re-encoding a document underneath a client (which a format
   * bump does to every row) is not a conflict.
   */
  version?: number;
  isPublic: boolean;
  link?: string;
  /**
   * Fork lineage, root-first, carried so it survives the document's round
   * trips; an upload sends the immediate parent's id and the server re-links
   * `forkedFrom`. Read-only: the server resolves the real authors itself.
   */
  attribution?: FileForkAttributionV1[];
}

interface ProjectEntry {
  metadata: ProjectMetadata;
  dirty: WritableSignal<boolean>;
  /** Bumped by every markDirty call, even when already dirty. */
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
   * Registers a project with its metadata. `trackDirty` subscribes to the
   * project's `actionManager.actionChange$`; read-only shares opt out. Either
   * way `remove()` tears the subscription down.
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
   * All registered projects with their metadata. Reactive: read inside a
   * computed or effect it tracks registrations and removals, so session-level
   * consumers see documents appear and disappear.
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
   * Epoch-ms of the project's last `markDirty`, or `undefined` when it has not
   * been edited this session. A one-shot snapshot, not reactive.
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
   * A token that changes on every `markDirty`, captured before async work and
   * compared on completion to detect concurrent edits.
   */
  public dirtyVersion(project: Project): number {
    return this._entries.get(project)?.dirtyVersion ?? 0;
  }

  /**
   * Runs an async save step under the mid-save edit guard. `fn` must include
   * the serialization, not just the write: the dirty flag is cleared only when
   * no edit landed while `fn` was in flight, so a save never marks newer edits
   * as saved. An error from `fn` propagates with the flag untouched.
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

  /** Adopts the version a cloud read or write answered with. */
  public updateVersion(project: Project, version: number): void {
    this.update(project, { version });
  }

  /**
   * Sets the store id once a project is first written to its backing store.
   * Re-`set`s the map entry rather than mutating it, so reactive readers see a
   * draft gain its store id.
   */
  public updateId(project: Project, id: string): void {
    this.update(project, { id });
  }

  /**
   * Merges `patch` into a project's metadata by re-`set`ting the map entry, so
   * reactive readers observe the change.
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
