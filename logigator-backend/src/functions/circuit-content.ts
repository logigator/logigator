import {classToPlain} from 'class-transformer';
import {ProjectElement} from '../models/request/api/project-element';
import {ProjectMapping} from '../models/request/api/project-mapping';
import {DependencySnapshot} from '../models/request/api/dependency-snapshot';

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
 */
export function serializeStoredCircuit(elements: ProjectElement[], mappings: ProjectMapping[]): string {
	const dependencies: StoredDependencySnapshot[] = mappings
		.filter(mapping => mapping.snapshot)
		.map(mapping => ({id: mapping.id, model: mapping.model, snapshot: mapping.snapshot}));

	if (dependencies.length === 0)
		return JSON.stringify(elements);

	return JSON.stringify({elements, dependencies} as WrappedCircuit);
}

/**
 * Builds the `dependencies` field of a circuit read response: the live dependency
 * rows (so old clients keep resolving always-latest masters) with each embedded
 * `snapshot` overlaid by matching model id, plus snapshot-only entries for
 * local-only customs that have no dependency row.
 */
export function buildDependencyResponse(depRows: object[], snapshots: StoredDependencySnapshot[], groups?: string[]): object[] {
	const byModel = new Map<number, DependencySnapshot>();
	for (const stored of snapshots)
		byModel.set(stored.model, stored.snapshot);

	const result: any[] = [];
	const covered = new Set<number>();
	for (const row of depRows) {
		const plain: any = classToPlain(row, groups ? {groups} : undefined);
		const snapshot = byModel.get(plain.model);
		if (snapshot) {
			plain.snapshot = snapshot;
			covered.add(plain.model);
		}
		result.push(plain);
	}

	for (const stored of snapshots) {
		if (!covered.has(stored.model))
			result.push({id: stored.id, model: stored.model, snapshot: stored.snapshot});
	}

	return result;
}
