/**
 * Records persisted in IndexedDB. The circuit is stored as `content`, the
 * native versioned file-format JSON, so the migration chain upgrades stored
 * circuits on load exactly as for a file import and every record is
 * self-contained. Each kind lives in its own object store, so the store — not
 * a field — is the discriminator.
 */
export interface StoredBrowserProject {
  /** Generated client-side; the `/local/:id` route key. */
  id: string;
  /** Duplicated out of `content` so listing does not have to parse every blob. */
  name: string;
  createdOn: number;
  lastEdited: number;
  content: string;
}

/**
 * A library master: the editable catalog entry the palette places from. Its
 * `content` carries its own circuit plus embedded snapshots of its
 * dependencies, so loading it needs no cross-row resolution, and its `id`
 * shares the id space with {@link StoredBrowserProject.id}.
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
  content: string;
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
