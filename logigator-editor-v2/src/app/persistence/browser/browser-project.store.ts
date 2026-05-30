import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import {
	BrowserProjectSummary,
	StoredBrowserProject
} from './browser-project.types';

const DB_NAME = 'logigator-editor';
const DB_VERSION = 1;
const STORE = 'projects';
const LAST_EDITED_INDEX = 'lastEdited';

/**
 * CRUD over browser-local (IndexedDB) circuits. A thin promise wrapper around a
 * single object store keyed by project id, with a `lastEdited` index for ordered
 * listing. It owns every storage concern — id generation, timestamps and
 * preserving `createdOn` across updates — so callers only supply `{ name, content }`.
 *
 * It knows nothing about `Project`, metadata or circuit encoding; `PersistenceService`
 * orchestrates those, mirroring how it drives `ProjectApiService` for the server target.
 */
@Injectable({ providedIn: 'root' })
export class BrowserProjectStore {
	private _dbPromise?: Promise<IDBDatabase>;

	/**
	 * Inserts or updates a project. Without an `id` a fresh one is generated and
	 * `createdOn` is stamped; with an existing `id` the original `createdOn` is
	 * preserved. `lastEdited` is always set to now. Returns the stored record.
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
			type: 'project',
			createdOn: existing?.createdOn ?? now,
			lastEdited: now,
			content: params.content
		};
		const db = await this._open();
		await this._run(db, 'readwrite', (store) => store.put(record));
		return record;
	}

	async get(id: string): Promise<StoredBrowserProject | undefined> {
		const db = await this._open();
		const result = await this._run<StoredBrowserProject | undefined>(
			db,
			'readonly',
			(store) => store.get(id)
		);
		return result ?? undefined;
	}

	/** Stored projects without their circuit data, newest `lastEdited` first. */
	async list(): Promise<BrowserProjectSummary[]> {
		const db = await this._open();
		const all = await this._run<StoredBrowserProject[]>(
			db,
			'readonly',
			(store) => store.index(LAST_EDITED_INDEX).getAll()
		);
		return all
			.sort((a, b) => b.lastEdited - a.lastEdited)
			.map(({ id, name, createdOn, lastEdited }) => ({
				id,
				name,
				createdOn,
				lastEdited
			}));
	}

	async delete(id: string): Promise<void> {
		const db = await this._open();
		await this._run(db, 'readwrite', (store) => store.delete(id));
	}

	// -- IndexedDB plumbing --------------------------------------------------

	private _open(): Promise<IDBDatabase> {
		if (!this._dbPromise) {
			this._dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
				const request = indexedDB.open(DB_NAME, DB_VERSION);
				request.onupgradeneeded = () => {
					const db = request.result;
					if (!db.objectStoreNames.contains(STORE)) {
						const store = db.createObjectStore(STORE, { keyPath: 'id' });
						store.createIndex(LAST_EDITED_INDEX, 'lastEdited');
					}
				};
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => {
					// Drop the cached rejection so a later call can retry the open.
					this._dbPromise = undefined;
					reject(request.error);
				};
			});
		}
		return this._dbPromise;
	}

	private _run<T>(
		db: IDBDatabase,
		mode: IDBTransactionMode,
		op: (store: IDBObjectStore) => IDBRequest
	): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const tx = db.transaction(STORE, mode);
			const request = op(tx.objectStore(STORE));
			// Resolve on transaction completion (not request success) so the write
			// is durable before the promise settles.
			tx.oncomplete = () => resolve(request.result as T);
			tx.onerror = () => reject(tx.error);
			tx.onabort = () => reject(tx.error);
		});
	}
}
