import { inject, Injectable } from '@angular/core';
import { filter, Observable, Subject } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { ComponentProviderService } from '../component-provider.service';
import { CUSTOM_TYPE_ID_BASE } from '../component-type.enum';
import {
	CustomComponentDefinition,
	CustomComponentSummaryPatch
} from './custom-component-definition.model';
import { buildCustomComponentConfig } from './custom-component.config';

/** A definition without its (registry-allocated) type id. */
type DefinitionInit = Omit<CustomComponentDefinition, 'typeId'>;

/**
 * Session-global owner of custom-component **definitions**, of two kinds (see
 * {@link CustomComponentDefinition}):
 *
 * - **masters** — editable library entries; what the palette places *from* and
 *   the user edits. Indexed by their persistent {@link CustomComponentDefinition.id}.
 * - **snapshots** — frozen copies embedded in projects; what a placed instance
 *   actually wraps. Each gets its own type id; they are **not** in the id index
 *   (many snapshots share one master id).
 *
 * It is an app-root singleton so runtime-allocated type ids never collide across
 * open Projects — `typeId → definition` is a clean function (Invariant B). It
 * registers a matching {@link ComponentConfig} into {@link ComponentProviderService}
 * for every definition (so all existing resolvers keep working through
 * `getComponent`), and tracks the library dependency graph for cycle prevention.
 */
@Injectable({
	providedIn: 'root'
})
export class CustomComponentRegistry {
	private readonly _provider = inject(ComponentProviderService);

	private _nextTypeId = CUSTOM_TYPE_ID_BASE;
	private readonly _definitions = new Map<number, CustomComponentDefinition>();
	// Masters only: persistent id -> masterTypeId. Snapshots are excluded — one id
	// maps to many snapshot type ids, so the reverse lookup is masters-only.
	private readonly _idToMasterTypeId = new Map<string, number>();
	// Library dependency edges: masterTypeId -> the distinct master type ids its
	// circuit places. Reverse-traversed by dependentsOf for cycle filtering.
	private readonly _dependencies = new Map<number, Set<number>>();
	private readonly _change$ = new Subject<CustomComponentDefinition>();

	/**
	 * Registers a new editable library **master** and returns its type id. A
	 * browser master mints a store id when none is supplied; a server master
	 * carries the id from its create POST. Added to the masters id index.
	 */
	public createMaster(
		meta: Partial<CustomComponentDefinition>,
		source: 'server' | 'browser'
	): number {
		// Match browser-project.store.ts: the `uuid` package, not crypto.randomUUID
		// (which needs a secure context and would throw over plain HTTP).
		const id = meta.id ?? uuidv4();
		const typeId = this._register({
			kind: 'master',
			source,
			id,
			version: meta.version ?? 1,
			name: meta.name ?? '',
			symbol: meta.symbol ?? '',
			description: meta.description ?? '',
			numInputs: meta.numInputs ?? 0,
			numOutputs: meta.numOutputs ?? 0,
			labels: meta.labels ? [...meta.labels] : [],
			circuit: meta.circuit
		});
		this._idToMasterTypeId.set(id, typeId);
		return typeId;
	}

	/**
	 * Freezes a master's **current** state into a snapshot definition (with
	 * `source`/`id`/`version` provenance) and registers it, returning the frozen
	 * definition. Used at place time and by `UpdateInstanceAction`. Each call
	 * produces a distinct snapshot type id; snapshots are never mutated.
	 */
	public snapshot(masterTypeId: number): CustomComponentDefinition {
		const master = this._definitions.get(masterTypeId);
		if (!master || master.kind !== 'master') {
			throw new Error(`No master definition for type id ${masterTypeId}`);
		}
		const typeId = this.registerSnapshot({
			kind: 'snapshot',
			source: master.source,
			id: master.id,
			version: master.version,
			name: master.name,
			symbol: master.symbol,
			description: master.description,
			numInputs: master.numInputs,
			numOutputs: master.numOutputs,
			labels: [...master.labels],
			circuit: master.circuit
		});
		return this._definitions.get(typeId)!;
	}

	/**
	 * Registers one frozen snapshot definition and returns its fresh type id. The
	 * lower-level primitive behind {@link snapshot} (and, in a later phase, the
	 * embedded-snapshot load path). Not added to the masters id index.
	 */
	public registerSnapshot(def: DefinitionInit): number {
		return this._register(def);
	}

	/**
	 * Applies a summary change to a **master** in place (never replacing the
	 * object) and notifies the palette/editor via {@link definitionChange$}.
	 * No-ops for an unknown type id or a snapshot (snapshots are immutable).
	 * Does **not** bump `version` — that is a save-time stamp.
	 */
	public updateDefinition(
		masterTypeId: number,
		patch: CustomComponentSummaryPatch
	): void {
		const def = this._definitions.get(masterTypeId);
		if (!def || def.kind !== 'master') return;

		def.numInputs = patch.numInputs;
		def.numOutputs = patch.numOutputs;
		def.labels = [...patch.labels];
		if (patch.symbol !== undefined) def.symbol = patch.symbol;
		if (patch.name !== undefined) def.name = patch.name;
		if (patch.description !== undefined) def.description = patch.description;

		this._change$.next(def);
	}

	public getDefinition(typeId: number): CustomComponentDefinition | undefined {
		return this._definitions.get(typeId);
	}

	/** Masters-only reverse lookup: persistent id -> masterTypeId. */
	public masterTypeIdForId(id: string): number | undefined {
		return this._idToMasterTypeId.get(id);
	}

	/** A snapshot's `source.id` provenance, or a master's own id. */
	public idForTypeId(typeId: number): string | undefined {
		return this._definitions.get(typeId)?.id;
	}

	/**
	 * Records a master's direct library dependencies (the distinct master type
	 * ids its circuit places). Recomputed whenever the master's contents change;
	 * consumed by {@link dependentsOf} for cycle prevention.
	 */
	public setDependencies(masterTypeId: number, deps: Iterable<number>): void {
		this._dependencies.set(masterTypeId, new Set(deps));
	}

	/** The direct library dependencies of `masterTypeId`. */
	public dependenciesOf(masterTypeId: number): ReadonlySet<number> {
		return this._dependencies.get(masterTypeId) ?? new Set<number>();
	}

	/**
	 * The transitive closure of masters that depend on `masterTypeId` (does not
	 * include it). Placing any of these inside its editor would close a cycle, so
	 * the palette excludes them while editing it.
	 */
	public dependentsOf(masterTypeId: number): ReadonlySet<number> {
		const result = new Set<number>();
		const stack: number[] = [masterTypeId];
		while (stack.length > 0) {
			const target = stack.pop() as number;
			for (const [from, deps] of this._dependencies) {
				if (deps.has(target) && !result.has(from)) {
					result.add(from);
					stack.push(from);
				}
			}
		}
		return result;
	}

	/**
	 * Emits whenever a **master's** summary changes (palette/editor refresh).
	 * Snapshots are frozen and never emit; a placed instance does not subscribe.
	 */
	public definitionChange$(
		typeId: number
	): Observable<CustomComponentDefinition> {
		return this._change$.pipe(filter((def) => def.typeId === typeId));
	}

	private _register(def: DefinitionInit): number {
		const typeId = this._nextTypeId++;
		const full: CustomComponentDefinition = { ...def, typeId };
		this._definitions.set(typeId, full);
		// Register the matching config so the serializer/actions/palette resolve
		// this custom type through the same provider path as built-ins. Masters
		// surface in the USER palette; snapshots are HIDDEN (resolvable, not listed).
		this._provider.register(buildCustomComponentConfig(full));
		return typeId;
	}
}
