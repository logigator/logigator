const DB_NAME = 'logigator-editor';
const DB_VERSION = 2;
const LAST_EDITED_INDEX = 'lastEdited';

/** Object store holding saved projects (`StoredBrowserProject`). */
export const PROJECTS_STORE = 'projects';
/** Object store holding library masters (`StoredBrowserComponent`). */
export const COMPONENTS_STORE = 'components';

let dbPromise: Promise<IDBDatabase> | undefined;

/**
 * Opens the shared editor database, creating every object store on demand. The
 * promise is cached module-wide so all {@link IndexedDbStore} instances share one
 * connection (and one `onupgradeneeded` pass).
 *
 * The version is bumped only to **create object stores** — it migrates no stored
 * records. Both stores are created here regardless of which store instance opens
 * the database first.
 */
function openDatabase(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of [PROJECTS_STORE, COMPONENTS_STORE]) {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: 'id' });
            store.createIndex(LAST_EDITED_INDEX, 'lastEdited');
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        // Drop the cached rejection so a later call can retry the open.
        dbPromise = undefined;
        reject(request.error);
      };
    });
  }
  return dbPromise;
}

/**
 * A thin promise wrapper over a single IndexedDB object store keyed by `id`, with
 * a `lastEdited` index for ordered listing. It owns no domain logic — id
 * generation, timestamps and the stored record shape live in the typed store
 * classes (`BrowserProjectStore` / `BrowserComponentStore`) that compose it.
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
      // Resolve on transaction completion (not request success) so the write
      // is durable before the promise settles.
      tx.oncomplete = () => resolve(request.result as R);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
}
