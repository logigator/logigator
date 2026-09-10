import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import {
  BrowserComponentSummary,
  StoredBrowserComponent
} from './browser-project.types';
import {
  COMPONENTS_STORE,
  IndexedDbStore
} from '../../storage/indexed-db-store';
import { CustomComponentDetails } from '@logigator/core';

/**
 * CRUD over IndexedDB library masters, keyed by master id. Owns id generation,
 * timestamps and `createdOn` preservation, and keeps the summary columns beside
 * the `content` so the palette lists masters without parsing each blob.
 * Encoding and the registry belong to `PersistenceService`.
 */
@Injectable({ providedIn: 'root' })
export class BrowserComponentStore {
  private readonly _store = new IndexedDbStore<StoredBrowserComponent>(
    COMPONENTS_STORE
  );

  /**
   * Inserts or updates a master. Without an `id` a fresh one is generated and
   * `createdOn` stamped; an existing record keeps its original `createdOn`.
   */
  async save(params: {
    id?: string;
    version: number;
    name: string;
    symbol: string;
    description: string;
    numInputs: number;
    numOutputs: number;
    labels: string[];
    content: string;
  }): Promise<StoredBrowserComponent> {
    const now = Date.now();
    const existing = params.id ? await this.get(params.id) : undefined;
    const record: StoredBrowserComponent = {
      id: params.id ?? uuidv4(),
      version: params.version,
      name: params.name,
      symbol: params.symbol,
      description: params.description,
      numInputs: params.numInputs,
      numOutputs: params.numOutputs,
      labels: [...params.labels],
      createdOn: existing?.createdOn ?? now,
      lastEdited: now,
      content: params.content
    };
    await this._store.put(record);
    return record;
  }

  get(id: string): Promise<StoredBrowserComponent | undefined> {
    return this._store.get(id);
  }

  /**
   * Patches a master's descriptive metadata in place, leaving `content` alone.
   * The `version` bump is what lets instances frozen at an older version be
   * offered an update, and the re-stamped `lastEdited` re-sorts the palette, as
   * the server PATCH does. Throws for an unknown id, so the caller aborts
   * without applying the edit anywhere else.
   */
  async updateDetails(
    id: string,
    details: CustomComponentDetails
  ): Promise<StoredBrowserComponent> {
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`No stored component with id ${id}`);
    }
    const record: StoredBrowserComponent = {
      ...existing,
      name: details.name,
      symbol: details.symbol,
      description: details.description,
      version: existing.version + 1,
      lastEdited: Date.now()
    };
    await this._store.put(record);
    return record;
  }

  /** Stored masters without their circuit data, newest `lastEdited` first. */
  async list(): Promise<BrowserComponentSummary[]> {
    const all = await this._store.listByLastEdited();
    return all.map(
      ({
        id,
        name,
        symbol,
        description,
        numInputs,
        numOutputs,
        labels,
        version,
        createdOn,
        lastEdited
      }) => ({
        id,
        name,
        symbol,
        description,
        numInputs,
        numOutputs,
        labels,
        version,
        createdOn,
        lastEdited
      })
    );
  }

  delete(id: string): Promise<void> {
    return this._store.delete(id);
  }
}
