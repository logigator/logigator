/**
 * The record shapes the browser (IndexedDB) stores work in. Each kind lives in
 * its own object store, so the store — not a field — is the discriminator.
 *
 * There are two shapes per kind, and the distinction matters:
 *
 * - `Stored…` is what {@link BrowserProjectStore}/{@link BrowserComponentStore}
 *   hand back and take in. Its `content` is the native versioned file-format
 *   JSON string, so a load rides the migration chain exactly as a file import
 *   does and every record is self-contained.
 * - `Persisted…` is what actually sits in IndexedDB. Its `content` is the
 *   `.lgix` container — the same bytes the document takes as a file on disk —
 *   so the one at-rest path that used to hold raw JSON is compressed too.
 *
 * The codec between them lives inside the two stores, and nothing outside them
 * sees a `Persisted…`.
 */

/** A saved circuit, as the store hands it back. */
export interface StoredBrowserProject {
  /** Generated client-side; the `/local/:id` route key. */
  id: string;
  /** Duplicated out of `content` so listing does not have to parse every blob. */
  name: string;
  createdOn: number;
  lastEdited: number;
  /** The native versioned file-format JSON. */
  content: string;
}

/**
 * A saved circuit, as it sits in IndexedDB. Structured-cloned natively, so the
 * `Uint8Array` needs no `DB_VERSION` bump — nothing indexes `content`.
 */
export interface PersistedBrowserProject extends Omit<
  StoredBrowserProject,
  'content'
> {
  /**
   * `.lgix` container bytes, or the bare JSON string for a record written
   * before browser storage was compressed. Legacy records are migrated by
   * sniffing the type on read — the store's own rule is that the DB version is
   * bumped only to create stores and migrates no records — and the next save
   * re-encodes them.
   */
  content: Uint8Array | string;
}

/**
 * A library master: the editable catalog entry the palette places from, as the
 * store hands it back. Its `content` carries its own circuit plus embedded
 * snapshots of its dependencies, so loading it needs no cross-row resolution,
 * and its `id` shares the id space with {@link StoredBrowserProject.id}.
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
  /** The native versioned file-format JSON. */
  content: string;
}

/**
 * A library master as it sits in IndexedDB; `content` follows the same rule as
 * {@link PersistedBrowserProject.content}.
 */
export interface PersistedBrowserComponent extends Omit<
  StoredBrowserComponent,
  'content'
> {
  content: Uint8Array | string;
}

/** Listing projection, without the circuit data. */
export type BrowserProjectSummary = Pick<
  StoredBrowserProject,
  'id' | 'name' | 'createdOn' | 'lastEdited'
>;

/** Listing projection, without the circuit data. */
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
