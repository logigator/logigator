import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import { decodeLgix, encodeLgix } from '@logigator/core';
import {
  BrowserProjectSummary,
  PersistedBrowserProject,
  StoredBrowserProject
} from './browser-project.types';
import { IndexedDbStore, PROJECTS_STORE } from '../../storage/indexed-db-store';

/**
 * CRUD over IndexedDB circuits, keyed by project id. Owns every storage concern
 * — id generation, timestamps, `createdOn` across updates, and the `.lgix`
 * container the record is written in — so callers supply only
 * `{ name, content }` and get the document JSON back. It knows nothing about
 * `Project`, metadata or circuit encoding; `PersistenceService` orchestrates
 * those.
 */
@Injectable({ providedIn: 'root' })
export class BrowserProjectStore {
  private readonly _store = new IndexedDbStore<PersistedBrowserProject>(
    PROJECTS_STORE
  );

  /**
   * Inserts or updates a project. Without an `id` a fresh one is generated and
   * `createdOn` stamped; an existing record keeps its original `createdOn`.
   * The circuit is written as `.lgix` bytes, whatever the record held before.
   */
  async save(params: {
    id?: string;
    name: string;
    content: string;
  }): Promise<StoredBrowserProject> {
    const now = Date.now();
    // The persisted record, not `get`: only `createdOn` is wanted, and
    // decoding the old circuit to read it would be wasted work.
    const existing = params.id ? await this._store.get(params.id) : undefined;
    const record: StoredBrowserProject = {
      id: params.id ?? uuidv4(),
      name: params.name,
      createdOn: existing?.createdOn ?? now,
      lastEdited: now,
      content: params.content
    };
    await this._store.put({
      ...record,
      content: await encodeLgix(params.content)
    });
    return record;
  }

  /**
   * The stored project with its circuit as JSON. A `string` `content` is a
   * record written before browser storage was compressed and is handed back
   * untouched; the next {@link save} re-encodes it. Rejects with
   * `InvalidFileError` if the container is corrupted, rather than yielding a
   * silently empty circuit.
   */
  async get(id: string): Promise<StoredBrowserProject | undefined> {
    const record = await this._store.get(id);
    if (!record) return undefined;
    const { content, ...rest } = record;
    return {
      ...rest,
      content: typeof content === 'string' ? content : await decodeLgix(content)
    };
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
