import { Injectable } from '@angular/core';
import {
  COMPONENT_ID_MAP_STORE,
  IndexedDbStore
} from '../../storage/indexed-db-store';

/**
 * One persisted alias. `lastEdited` exists only to satisfy the shared
 * {@link IndexedDbStore} record shape.
 */
export interface StoredComponentIdMapping {
  /** The pre-promotion local id, and the store key. */
  id: string;
  /** The server id the component was promoted to. */
  newId: string;
  lastEdited: number;
}

/**
 * Durable old-local-id → server-id alias map, written when a browser master is
 * promoted. Loaded into the registry at startup so a snapshot that captured the
 * old local id still resolves to the now-server master.
 */
@Injectable({ providedIn: 'root' })
export class ComponentIdMapStore {
  private readonly _store = new IndexedDbStore<StoredComponentIdMapping>(
    COMPONENT_ID_MAP_STORE
  );

  put(oldId: string, newId: string): Promise<void> {
    return this._store.put({ id: oldId, newId, lastEdited: Date.now() });
  }

  list(): Promise<StoredComponentIdMapping[]> {
    return this._store.listByLastEdited();
  }
}
