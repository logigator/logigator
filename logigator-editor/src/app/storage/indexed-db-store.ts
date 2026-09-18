import { getStaticDI } from '../utils/get-di';
import { LoggingService } from '../logging/logging.service';

const DB_NAME = 'logigator-editor';
const DB_VERSION = 3;
const LAST_EDITED_INDEX = 'lastEdited';

/** Guarded so a diagnostic can never mask the real IndexedDB rejection. */
function tryLogging(): LoggingService | undefined {
  try {
    return getStaticDI(LoggingService);
  } catch {
    return undefined;
  }
}

/** Object store holding saved projects (`StoredBrowserProject`). */
export const PROJECTS_STORE = 'projects';
/** Object store holding library masters (`StoredBrowserComponent`). */
export const COMPONENTS_STORE = 'components';
/**
 * Maps a master's pre-promotion local id to the server id it was promoted to,
 * so snapshots holding the old id still resolve after an upload-to-cloud.
 */
export const COMPONENT_ID_MAP_STORE = 'componentIdMap';

let dbPromise: Promise<IDBDatabase> | undefined;

/**
 * Opens the shared editor database, creating every object store on demand. The
 * promise is cached module-wide, so all {@link IndexedDbStore} instances share
 * one connection and one `onupgradeneeded` pass. The version is bumped only to
 * create stores; it migrates no records.
 */
function openDatabase(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of [
          PROJECTS_STORE,
          COMPONENTS_STORE,
          COMPONENT_ID_MAP_STORE
        ]) {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: 'id' });
            store.createIndex(LAST_EDITED_INDEX, 'lastEdited');
            tryLogging()?.debug(
              `Creating IndexedDB store '${name}' (db v${DB_VERSION})`,
              'IndexedDbStore'
            );
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        tryLogging()?.debug(
          `Failed to open IndexedDB '${DB_NAME}': ${request.error?.message}`,
          'IndexedDbStore'
        );
        // Drop the cached rejection so a later call can retry the open.
        dbPromise = undefined;
        reject(request.error);
      };
    });
  }
  return dbPromise;
}

/**
 * A promise wrapper over one IndexedDB object store keyed by `id`, with a
 * `lastEdited` index for ordered listing. No domain logic: id generation,
 * timestamps and the record shape belong to the typed stores that compose it.
 */
export class IndexedDbStore<T extends { id: string; lastEdited: number }> {
  constructor(private readonly storeName: string) {}

  async get(id: string): Promise<T | undefined> {
    const db = await openDatabase();
    const result = await this._run<T | undefined>(db, 'readonly', (store) =>
      store.get(id)
    );
    return result ?? undefined;
  }

  async put(record: T): Promise<void> {
    const db = await openDatabase();
    await this._run(db, 'readwrite', (store) => store.put(record));
  }

  async delete(id: string): Promise<void> {
    const db = await openDatabase();
    await this._run(db, 'readwrite', (store) => store.delete(id));
  }

  /** Every stored record, newest `lastEdited` first. */
  async listByLastEdited(): Promise<T[]> {
    const db = await openDatabase();
    const all = await this._run<T[]>(db, 'readonly', (store) =>
      store.index(LAST_EDITED_INDEX).getAll()
    );
    return all.sort((a, b) => b.lastEdited - a.lastEdited);
  }

  private _run<R>(
    db: IDBDatabase,
    mode: IDBTransactionMode,
    op: (store: IDBObjectStore) => IDBRequest
  ): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      const tx = db.transaction(this.storeName, mode);
      const request = op(tx.objectStore(this.storeName));
      // Completion, not request success, so the write is durable first.
      tx.oncomplete = () => resolve(request.result as R);
      const fail = () => {
        tryLogging()?.debug(
          `IndexedDB ${mode} transaction on '${this.storeName}' failed: ${tx.error?.message}`,
          'IndexedDbStore'
        );
        reject(tx.error);
      };
      tx.onerror = fail;
      tx.onabort = fail;
    });
  }
}
