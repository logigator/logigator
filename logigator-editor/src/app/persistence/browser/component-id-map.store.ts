import { Injectable } from '@angular/core';
import {
  COMPONENT_ID_MAP_STORE,
  IndexedDbStore
} from '../../storage/indexed-db-store';

/**
 * One persisted alias: a master's old (pre-promotion) local id and the server id
 * it was promoted to. `lastEdited` exists only to satisfy the shared
 * {@link IndexedDbStore} record shape (the store's ordered-listing index).
 */
export interface StoredComponentIdMapping {
  /** The old (pre-promotion) local id — the store key. */
  id: string;
  /** The server id the component was promoted to. */
  newId: string;
  lastEdited: number;
}

/**
 * Durable old-local-id → server-id alias map, written when a browser master is
 * promoted to the cloud ({@link PromotionService.promoteComponentToServer}).
 * Loaded into the registry at startup so snapshots embedded before the promotion
 * still resolve to the now-server master (their captured id is the old local id).
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
