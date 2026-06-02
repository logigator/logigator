import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import {
	BrowserComponentSummary,
	StoredBrowserComponent
} from './browser-project.types';
import { COMPONENTS_STORE, IndexedDbStore } from './indexed-db-store';

/**
 * CRUD over browser-local (IndexedDB) **library masters**, keyed by master id.
 * The sibling of `BrowserProjectStore`: it owns id generation, timestamps and
 * `createdOn` preservation, and stores the master summary columns alongside the
 * `content` so the palette can list masters without parsing each circuit blob.
 *
 * `PersistenceService` orchestrates encoding and the registry; this store knows
 * only its record shape.
 */
@Injectable({ providedIn: 'root' })
export class BrowserComponentStore {
	private readonly _store = new IndexedDbStore<StoredBrowserComponent>(
		COMPONENTS_STORE
	);

	/**
	 * Inserts or updates a master. Without an `id` a fresh one is generated and
	 * `createdOn` is stamped; with an existing `id` the original `createdOn` is
	 * preserved. `lastEdited` is always set to now. Returns the stored record.
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
