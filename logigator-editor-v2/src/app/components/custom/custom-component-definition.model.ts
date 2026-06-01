/**
 * A session definition of a custom component — enough to render and place a
 * black-box instance. Every definition is one of two **kinds**:
 *
 * - a **master** — the editable library/catalog entry. Mutable; it owns the
 *   persistent {@link id} and is what the user places *from* and edits.
 * - a **snapshot** — a **frozen** copy embedded in a host project at place time,
 *   carrying provenance ({@link id} + {@link version}) back to its master. A
 *   placed instance always wraps a snapshot, so editing a master never changes
 *   already-placed instances (see the custom-components plan, §G).
 *
 * The "one mutable object, mutated in place by `updateDefinition`" rule applies
 * **only to masters**. Snapshots are immutable — created frozen and never edited;
 * bringing an instance up to date replaces it with a *new* snapshot.
 */
export interface CustomComponentDefinition {
	/** Session-local numeric type id — the value written as `t` in the wire format. */
	readonly typeId: number;
	/** `master` = editable catalog entry; `snapshot` = frozen placed copy. */
	kind: 'master' | 'snapshot';
	/** Which library the {@link id} belongs to. */
	source: 'server' | 'browser';
	/**
	 * Persistent identity (a string, never conflated with {@link typeId}). For a
	 * master: its own id (server uuid / browser store id). For a snapshot: the id
	 * of the master it was copied from (provenance, used only to offer an explicit
	 * "update"). Reverse `id → typeId` is masters-only — one id maps to many
	 * snapshot type ids.
	 */
	id?: string;
	/** Master: its current monotonic version. Snapshot: the master version this copy was taken at. */
	version?: number;
	name: string;
	symbol: string;
	description: string;
	/** Derived from INPUT plug count. */
	numInputs: number;
	/** Derived from OUTPUT plug count. */
	numOutputs: number;
	/** Port labels, inputs first then outputs, in plug-index order. */
	labels: string[];
	/**
	 * The definition's own circuit. For a snapshot: travels embedded with the
	 * host document (present once loaded). For a master: materialised while open
	 * for editing / freshly created. Not consumed yet — persistence lands in
	 * later phases.
	 */
	circuit?: { components: unknown[]; wires: unknown[] };
}

/**
 * The patch applied when a **master's** plugs change (see `deriveSummary`).
 * Port counts and labels are always recomputed together; the descriptive
 * fields are optional and only set when the create/edit dialog changes them.
 */
export interface CustomComponentSummaryPatch {
	numInputs: number;
	numOutputs: number;
	labels: string[];
	symbol?: string;
	name?: string;
	description?: string;
}
