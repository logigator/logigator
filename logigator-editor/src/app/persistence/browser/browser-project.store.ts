import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import {
  BrowserProjectSummary,
  StoredBrowserProject
} from './browser-project.types';
import { IndexedDbStore, PROJECTS_STORE } from '../../storage/indexed-db-store';

/**
 * CRUD over IndexedDB circuits, keyed by project id. Owns every storage concern
 * — id generation, timestamps, `createdOn` across updates — so callers supply
 * only `{ name, content }`. It knows nothing about `Project`, metadata or
 * circuit encoding; `PersistenceService` orchestrates those.
 */
@Injectable({ providedIn: 'root' })
export class BrowserProjectStore {
  private readonly _store = new IndexedDbStore<StoredBrowserProject>(
    PROJECTS_STORE
  );

  /**
   * Inserts or updates a project. Without an `id` a fresh one is generated and
   * `createdOn` stamped; an existing record keeps its original `createdOn`.
   */
  async save(params: {
    id?: string;
    name: string;
    content: string;
  }): Promise<StoredBrowserProject> {
    const now = Date.now();
    const existing = params.id ? await this.get(params.id) : undefined;
    const record: StoredBrowserProject = {
      id: params.id ?? uuidv4(),
      name: params.name,
      createdOn: existing?.createdOn ?? now,
      lastEdited: now,
      content: params.content
    };
    await this._store.put(record);
    return record;
  }

  get(id: string): Promise<StoredBrowserProject | undefined> {
    return this._store.get(id);
  }

  /** Stored projects without their circuit data, newest `lastEdited` first. */
  async list(): Promise<BrowserProjectSummary[]> {
    const all = await this._store.listByLastEdited();
    return all.map(({ id, name, createdOn, lastEdited }) => ({
      id,
      name,
      createdOn,
      lastEdited
    }));
  }

  delete(id: string): Promise<void> {
    return this._store.delete(id);
  }
}
