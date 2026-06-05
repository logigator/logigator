import { Injectable, signal, WritableSignal } from '@angular/core';
import { Subscription } from 'rxjs';
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
  actionSub?: Subscription;
}

@Injectable({ providedIn: 'root' })
export class ProjectMetadataStore {
  private readonly _entries = new Map<Project, ProjectEntry>();

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
    entry.dirty.set(true);
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

  public updateHash(project: Project, hash: string): void {
    const entry = this._entries.get(project);
    if (entry) {
      entry.metadata.hash = hash;
    }
  }

  /**
   * Sets the store id after a project is first written to its backing store
   * (e.g. a fresh browser project promoted into IndexedDB on its first save).
   */
  public updateId(project: Project, id: string): void {
    const entry = this._entries.get(project);
    if (entry) {
      entry.metadata.id = id;
    }
  }
}
