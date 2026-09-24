import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import {
  CustomComponentDetails,
  decodeLgix,
  encodeLgix
} from '@logigator/core';
import {
  BrowserComponentSummary,
  PersistedBrowserComponent,
  StoredBrowserComponent
} from './browser-project.types';
import {
  COMPONENTS_STORE,
  IndexedDbStore
} from '../../storage/indexed-db-store';

/**
 * CRUD over IndexedDB library masters, keyed by master id. Owns id generation,
 * timestamps, `createdOn` preservation and the `.lgix` container the circuit is
 * written in, and keeps the summary columns beside the `content` so the palette
 * lists masters without parsing each blob. Encoding and the registry belong to
 * `PersistenceService`.
 */
@Injectable({ providedIn: 'root' })
export class BrowserComponentStore {
  private readonly _store = new IndexedDbStore<PersistedBrowserComponent>(
    COMPONENTS_STORE
  );

  /**
   * Inserts or updates a master. Without an `id` a fresh one is generated and
   * `createdOn` stamped; an existing record keeps its original `createdOn`.
   * The circuit is written as `.lgix` bytes, whatever the record held before.
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
    // The persisted record, not `get`: only `createdOn` is wanted, and
    // decoding the old circuit to read it would be wasted work.
    const existing = params.id ? await this._store.get(params.id) : undefined;
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
    await this._store.put({
      ...record,
      content: await encodeLgix(params.content)
    });
    return record;
  }

  /**
   * The stored master with its circuit as JSON. A `string` `content` is a
   * record written before browser storage was compressed and is handed back
   * untouched; the next {@link save} re-encodes it. Rejects with
   * `InvalidFileError` if the container is corrupted, rather than yielding a
   * silently empty circuit.
   */
  async get(id: string): Promise<StoredBrowserComponent | undefined> {
    const record = await this._store.get(id);
    if (!record) return undefined;
    const { content, ...rest } = record;
    return {
      ...rest,
      content: typeof content === 'string' ? content : await decodeLgix(content)
    };
  }

  /**
   * Patches a master's descriptive metadata in place, leaving `content` alone
   * — the stored bytes are carried over verbatim, so this neither pays a
   * decode/encode round trip nor rewrites a legacy record it does not touch.
   * The `version` bump is what lets instances frozen at an older version be
   * offered an update, and the re-stamped `lastEdited` re-sorts the palette, as
   * the server PATCH does. Throws for an unknown id, so the caller aborts
   * without applying the edit anywhere else. Answers the summary columns alone,
   * the circuit being exactly what it was.
   */
  async updateDetails(
    id: string,
    details: CustomComponentDetails
  ): Promise<BrowserComponentSummary> {
    const existing = await this._store.get(id);
    if (!existing) {
      throw new Error(`No stored component with id ${id}`);
    }
    const record: PersistedBrowserComponent = {
      ...existing,
      name: details.name,
      symbol: details.symbol,
      description: details.description,
      version: existing.version + 1,
      lastEdited: Date.now()
    };
    await this._store.put(record);
    return this._summary(record);
  }

  /** Stored masters without their circuit data, newest `lastEdited` first. */
  async list(): Promise<BrowserComponentSummary[]> {
    const all = await this._store.listByLastEdited();
    return all.map((record) => this._summary(record));
  }

  delete(id: string): Promise<void> {
    return this._store.delete(id);
  }

  /** The summary columns of a record, dropping the encoded circuit. */
  private _summary({
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
  }: PersistedBrowserComponent): BrowserComponentSummary {
    return {
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
    };
  }
}
