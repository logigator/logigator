import {classToPlain} from 'class-transformer';
import {ProjectElement} from '../models/request/api/project-element';
import {ProjectMapping} from '../models/request/api/project-mapping';
import {DependencySnapshot} from '../models/request/api/dependency-snapshot';

/** A type id `>= this` is a custom-component reference (mirrors the editor). */
const CUSTOM_TYPE_ID_BASE = 1000;

/** One embedded dependency snapshot as stored in / read from the circuit blob. */
interface StoredDependencySnapshot {
	id: string;
	model: number;
	snapshot: DependencySnapshot;
}

/** Persisted circuit blob carrying embedded snapshots (new clients). */
interface WrappedCircuit {
	elements: ProjectElement[];
	dependencies: StoredDependencySnapshot[];
}

/**
 * The minimal shape of a dependency row needed to synthesize a snapshot from the
 * live master. Structural so this module stays free of entity imports.
 */
interface DependencyRowLike {
	model_id: number;
	dependency: {
		id: string;
		name: string;
		symbol: string;
		description: string;
		numInputs: number;
		numOutputs: number;
		labels: string[];
		elementsFile?: { getFileContent(): Promise<Buffer> };
	};
}

/**
 * The elements file historically stored a bare `ProjectElement[]`. New clients
 * additionally embed per-dependency snapshots, so the blob becomes a
 * {@link WrappedCircuit}. This reader accepts both shapes and always returns the
 * unwrapped elements plus any snapshots (empty for legacy blobs).
 */
export function parseStoredCircuit(buffer: Buffer | undefined): { elements: ProjectElement[]; snapshots: StoredDependencySnapshot[] } {
	if (!buffer?.length)
		return {elements: [], snapshots: []};

	const parsed = JSON.parse(buffer.toString());
	if (Array.isArray(parsed))
		return {elements: parsed, snapshots: []};

	return {
		elements: Array.isArray(parsed.elements) ? parsed.elements : [],
		snapshots: Array.isArray(parsed.dependencies) ? parsed.dependencies : []
	};
}

/**
 * Serializes the circuit for storage. Stays a bare `ProjectElement[]` (identical
 * to the legacy shape) when no dependency carries a snapshot, so old clients and
 * snapshot-free saves are unaffected; wraps only when there is something to embed.
 *
 * `carriedSnapshots` are the snapshots already stored for this resource. When a
 * client sends dependencies but none carry a snapshot (the old editor, which has
 * no concept of them), the previously stored set is preserved verbatim instead of
 * being wiped — so an old-editor round-trip no longer strips the frozen circuits.
 * The whole set is kept (not just the placed top-level ones) to keep each
 * snapshot's nested-dependency closure intact.
 */
export function serializeStoredCircuit(elements: ProjectElement[], mappings: ProjectMapping[], carriedSnapshots: StoredDependencySnapshot[] = []): string {
	let dependencies: StoredDependencySnapshot[] = mappings
		.filter(mapping => mapping.snapshot)
		.map(mapping => ({id: mapping.id, model: mapping.model, snapshot: mapping.snapshot}));

	// Old editor: sent dependencies but no snapshots -> keep what we already have
	// rather than dropping it. An empty `mappings` means the client cleared all
	// customs, so nothing is carried.
	if (dependencies.length === 0 && mappings.length > 0)
		dependencies = carriedSnapshots;

	if (dependencies.length === 0)
		return JSON.stringify(elements);

	return JSON.stringify({elements, dependencies} as WrappedCircuit);
}

/**
 * Whether a stored circuit predates the new editor's format — it carries neither
 * embedded snapshots nor port negation. Computed from the *stored* blob (before
 * read-time snapshot synthesis), so it reflects which editor last saved it. The
 * editors surface a warning on the version mismatch from this flag.
 */
export function isLegacyFormat(elements: ProjectElement[], storedSnapshots: StoredDependencySnapshot[]): boolean {
	if (storedSnapshots.length > 0)
		return false;

	return !elements.some(element =>
		(element.negInputs && element.negInputs.length > 0) ||
		(element.negOutputs && element.negOutputs.length > 0)
	);
}

/**
 * Backfills snapshots for dependency rows that have none stored (e.g. a project
 * authored by the old editor, which embeds nothing). The frozen circuit is
 * reconstructed from the live master's elements + metadata, so the new editor can
 * render the custom instead of dropping it. Rendered at the master's *current*
 * state (as-placed state was never stored).
 *
 * Only **leaf** masters (whose own elements place no further custom, i.e. no
 * `t >= CUSTOM_TYPE_ID_BASE`) are synthesized: a hierarchical master's nested
 * references live in its own file-local id namespace, which would collide with
 * this document's ids and resolve to the wrong component. Those are left
 * reference-only (dropped on load), unchanged from before.
 */
export async function synthesizeMissingSnapshots(depRows: DependencyRowLike[], snapshots: StoredDependencySnapshot[]): Promise<StoredDependencySnapshot[]> {
	const covered = new Set(snapshots.map(stored => stored.model));
	const result = [...snapshots];

	for (const row of depRows) {
		if (covered.has(row.model_id))
			continue;

		const master = row.dependency;
		const {elements} = parseStoredCircuit(await master.elementsFile?.getFileContent());
		if (elements.some(element => element.t >= CUSTOM_TYPE_ID_BASE))
			continue;

		result.push({
			id: master.id,
			model: row.model_id,
			snapshot: {
				version: 1,
				name: master.name,
				symbol: master.symbol,
				description: master.description,
				numInputs: master.numInputs,
				numOutputs: master.numOutputs,
				labels: master.labels ?? [],
				elements
			}
		});
	}

	return result;
}

/**
 * Builds the `dependencies` field of a circuit read response: the live dependency
 * rows (so old clients keep resolving always-latest masters) with each embedded
 * `snapshot` overlaid, plus snapshot-only entries for local-only customs that have
 * no dependency row.
 *
 * A snapshot is overlaid onto a row matching its model id; when the snapshot also
 * carries a (non-empty) library id, the row's dependency id must match too, so a
 * carried-over snapshot can never attach to an unrelated row that happens to reuse
 * the same file-local model id.
 */
export function buildDependencyResponse(depRows: object[], snapshots: StoredDependencySnapshot[], groups?: string[]): object[] {
	const result: any[] = [];
	const covered = new Set<StoredDependencySnapshot>();

	for (const row of depRows) {
		const plain: any = classToPlain(row, groups ? {groups} : undefined);
		const match = snapshots.find(stored =>
			stored.model === plain.model && (!stored.id || stored.id === plain.dependency?.id)
		);
		if (match) {
			plain.snapshot = match.snapshot;
			covered.add(match);
		}
		result.push(plain);
	}

	for (const stored of snapshots) {
		if (!covered.has(stored))
			result.push({id: stored.id, model: stored.model, snapshot: stored.snapshot});
	}

	return result;
}
