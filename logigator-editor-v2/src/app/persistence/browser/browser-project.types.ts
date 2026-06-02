/**
 * Records persisted in the browser (IndexedDB). The circuit itself is stored as
 * `content` — the native versioned file-format JSON string produced by
 * `CircuitFileService.toJson` (body + embedded `definitions[]`). Reusing that
 * encoding means the file migration chain upgrades stored circuits on load for
 * free, exactly like a file import, and every stored document is self-contained.
 *
 * Each lives in its own object store (`projects` / `components`), so the store —
 * not a field — is the discriminator.
 */
export interface StoredBrowserProject {
	/** Generated client-side; the `/local/:id` route key. */
	id: string;
	/** Duplicated out of `content` so listing does not have to parse every blob. */
	name: string;
	createdOn: number;
	lastEdited: number;
	/** `CircuitFileService.toJson(...)` output (native versioned file format). */
	content: string;
}

/**
 * A **library master** stored in the browser `components` object store: the
 * editable catalog entry the palette places *from* and the user edits. Its
 * `content` is its own circuit plus embedded snapshots of its dependencies, so
 * loading it needs no cross-row resolution. Its `id` shares the id space with
 * {@link StoredBrowserProject.id}.
 */
export interface StoredBrowserComponent {
	id: string;
	/** Bumped on save; copied into placed snapshots' `source.version`. */
	version: number;
	name: string;
	symbol: string;
	description: string;
	// Summary columns, duplicated out of `content` so the palette lists masters
	// without parsing each blob.
	numInputs: number;
	numOutputs: number;
	labels: string[];
	createdOn: number;
	lastEdited: number;
	/** `CircuitFileService.toJson(...)` output (body + `definitions[]`). */
	content: string;
}

/** Lightweight projection for listing stored projects without their circuit data. */
export type BrowserProjectSummary = Pick<
	StoredBrowserProject,
	'id' | 'name' | 'createdOn' | 'lastEdited'
>;

/** Lightweight projection for listing stored masters without their circuit data. */
export type BrowserComponentSummary = Pick<
	StoredBrowserComponent,
	| 'id'
	| 'name'
	| 'symbol'
	| 'description'
	| 'numInputs'
	| 'numOutputs'
	| 'labels'
	| 'version'
	| 'createdOn'
	| 'lastEdited'
>;
