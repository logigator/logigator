// ---- Response envelope ----

/** Every API response is wrapped in { status, data }. */
export interface ApiResponse<T> {
	status: number;
	data: T;
}

// ---- Pagination ----

export interface Page<T> {
	page: number;
	total: number;
	count: number;
	entries: T[];
}

// ---- Persisted resources ----

/** A file stored on the backend filesystem (elementsFile, preview images). */
export interface PersistedResource {
	hash: string;
	mimeType: string;
	publicUrl: string;
}

// ---- Common circuit resource fields ----

/** Fields shared by Project and Component entities. */
export interface CircuitResource {
	id: string;
	name: string;
	description: string;
	createdOn: string;
	lastEdited: string;
	elementsFile: PersistedResource | null;
	previewDark: PersistedResource | null;
	previewLight: PersistedResource | null;
	/** Only present when serialized with showShareLinks group. */
	link?: string;
	public: boolean;
	forkedFrom?: { id: string } | null;
}
