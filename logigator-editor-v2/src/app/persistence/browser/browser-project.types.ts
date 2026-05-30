/**
 * A circuit persisted in the browser (IndexedDB). The circuit itself is stored
 * as `content` — the native versioned file-format JSON string produced by
 * `CircuitFileService.toJson`. Reusing that encoding means the file migration
 * chain upgrades stored circuits on load for free, exactly like a file import.
 */
export interface StoredBrowserProject {
	/** Generated client-side (`crypto.randomUUID`); the `/local/:id` route key. */
	id: string;
	/** Duplicated out of `content` so listing does not have to parse every blob. */
	name: string;
	/** Components (`'comp'`) are not yet stored in the browser. */
	type: 'project';
	createdOn: number;
	lastEdited: number;
	/** `CircuitFileService.toJson(...)` output (native versioned file format). */
	content: string;
}

/** Lightweight projection for listing stored projects without their circuit data. */
export type BrowserProjectSummary = Pick<
	StoredBrowserProject,
	'id' | 'name' | 'createdOn' | 'lastEdited'
>;
