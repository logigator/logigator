import { inject, Injectable, signal } from '@angular/core';
import { filter, Observable, Subject } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { ComponentProviderService } from '../component-provider.service';
import { LoggingService } from '../../logging/logging.service';
import {
  cloneCircuit,
  CUSTOM_TYPE_ID_BASE,
  CustomComponentDefinition,
  CustomComponentSummaryPatch,
  remapComponentTypes,
  SerializedCircuitBody,
  SnapshotDefinition
} from '@logigator/core';
import { buildCustomComponentConfig } from './custom-component.config';

/** A definition without its (registry-allocated) type id. */
type DefinitionInit = Omit<CustomComponentDefinition, 'typeId'>;

/**
 * Session-global owner of custom-component definitions, of two kinds:
 *
 * - **masters** — editable library entries the palette places *from*, indexed
 *   by their persistent id.
 * - **snapshots** — frozen copies embedded in projects; what a placed
 *   instance wraps. Each gets its own type id and none is in the id index,
 *   since many snapshots share one master id.
 *
 * App-root singleton so runtime-allocated type ids never collide across open
 * Projects: `typeId → definition` is a function. Every definition also gets a
 * config in {@link ComponentProviderService}, so customs resolve through the
 * same path as built-ins.
 */
@Injectable({
  providedIn: 'root'
})
export class CustomComponentRegistry {
  private readonly _provider = inject(ComponentProviderService);
  private readonly logging = inject(LoggingService);

  private _nextTypeId = CUSTOM_TYPE_ID_BASE;
  private readonly _definitions = new Map<number, CustomComponentDefinition>();
  // Masters only: one id maps to many snapshot type ids.
  private readonly _idToMasterTypeId = new Map<string, number>();
  // Old (pre-promotion) id -> current id: a master promoted browser->server
  // keeps its old local id here, so snapshots that captured it still resolve.
  private readonly _idAliases = new Map<string, string>();
  // masterTypeId -> the distinct master type ids its circuit places.
  private readonly _dependencies = new Map<number, Set<number>>();
  // Placement-time cache of the snapshot representing a master's current
  // state; cleared by every mutation of master content.
  private readonly _masterToSnapshotTypeId = new Map<number, number>();
  private readonly _change$ = new Subject<CustomComponentDefinition>();
  private readonly _revision = signal(0);
  /** Bumped on changes to a master's palette-visible metadata. */
  public readonly revision = this._revision.asReadonly();

  /** A browser master mints a store id; a server master is given one. */
  public createMaster(
    meta: Partial<CustomComponentDefinition>,
    source: 'server' | 'browser'
  ): number {
    // Not crypto.randomUUID: it needs a secure context and would throw over
    // plain HTTP.
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
      link: meta.link,
      isPublic: meta.isPublic,
      // No timestamp means it is being created now, so it sorts to the top.
      lastEdited: meta.lastEdited ?? Date.now(),
      circuit: meta.circuit ? cloneCircuit(meta.circuit) : undefined
    });
    this._idToMasterTypeId.set(id, typeId);
    return typeId;
  }

  /**
   * Freezes a master's current state into a snapshot with `source`/`id`/
   * `version` provenance. Repeated calls for an unchanged master return the
   * cached snapshot, so every placement shares one type id and the save file
   * holds one definition; every mutation of master content clears that cache.
   */
  public snapshot(masterTypeId: number): CustomComponentDefinition {
    const master = this._definitions.get(masterTypeId);
    if (!master || master.kind !== 'master') {
      throw new Error(`No master definition for type id ${masterTypeId}`);
    }
    const cached = this._masterToSnapshotTypeId.get(masterTypeId);
    if (cached !== undefined) return this._definitions.get(cached)!;
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
      // A frozen snapshot must not share circuit state with its master.
      circuit: master.circuit ? cloneCircuit(master.circuit) : undefined
    });
    this._masterToSnapshotTypeId.set(masterTypeId, typeId);
    return this._definitions.get(typeId)!;
  }

  /** Registers one frozen snapshot; not added to the masters id index. */
  public registerSnapshot(def: DefinitionInit): number {
    return this._register(def);
  }

  /**
   * Registers a document's embedded snapshots and returns the
   * `fileLocalType → sessionType` remap to apply to the document body.
   *
   * Two passes so nested references resolve: pass 1 allocates a session type id
   * per definition, pass 2 registers each with the type ids inside its own
   * circuit rewritten. A stored circuit therefore holds session ids, never
   * file-local ones.
   */
  public ingestSnapshots(defs: SnapshotDefinition[]): Map<number, number> {
    const remap = new Map<number, number>();
    for (const def of defs) {
      remap.set(def.type, this._nextTypeId++);
    }
    for (const def of defs) {
      const typeId = remap.get(def.type)!;
      this._store({
        typeId,
        kind: 'snapshot',
        // Older documents omit the origin; assume browser.
        source: def.source?.origin ?? 'browser',
        id: def.source?.id,
        version: def.source?.version,
        name: def.name,
        symbol: def.symbol,
        description: def.description,
        numInputs: def.numInputs,
        numOutputs: def.numOutputs,
        labels: [...def.labels],
        circuit: {
          components: remapComponentTypes(def.components, remap),
          wires: def.wires.map((w) => ({
            pos: [w.pos[0], w.pos[1]],
            direction: w.direction,
            length: w.length
          }))
        }
      });
    }
    // Where an ingested snapshot matches a loaded master at the same version,
    // seed the placement cache with it: later placements then reuse that type
    // id instead of writing a duplicate definition on save.
    for (const def of defs) {
      if (!def.source) continue;
      const masterTypeId = this._idToMasterTypeId.get(def.source.id);
      if (masterTypeId === undefined) continue;
      const master = this._definitions.get(masterTypeId);
      if (!master || master.version !== def.source.version) continue;
      if (!this._masterToSnapshotTypeId.has(masterTypeId)) {
        this._masterToSnapshotTypeId.set(masterTypeId, remap.get(def.type)!);
      }
    }

    this.logging.debug(
      `ingested ${defs.length} snapshots, remap size ${remap.size}`,
      'CustomComponentRegistry'
    );
    return remap;
  }

  /**
   * Patches a master in place, never replacing the object. Leaves `version`
   * alone: that is a save-time stamp.
   */
  public updateDefinition(
    masterTypeId: number,
    patch: CustomComponentSummaryPatch
  ): void {
    const def = this._definitions.get(masterTypeId);
    if (!def || def.kind !== 'master') {
      this._noopMaster('updateDefinition', masterTypeId);
      return;
    }

    def.numInputs = patch.numInputs;
    def.numOutputs = patch.numOutputs;
    def.labels = [...patch.labels];
    if (patch.symbol !== undefined) def.symbol = patch.symbol;
    if (patch.name !== undefined) def.name = patch.name;
    if (patch.description !== undefined) def.description = patch.description;

    this._masterToSnapshotTypeId.delete(masterTypeId);
    this._change$.next(def);
  }

  /**
   * Materialises a master's own circuit. Replaces `circuit` with a fresh deep
   * copy rather than mutating in place, so earlier snapshots stay frozen, and
   * recomputes the master's dependencies so cycle detection stays correct
   * whatever path set the circuit.
   */
  public setMasterCircuit(
    masterTypeId: number,
    circuit: SerializedCircuitBody
  ): void {
    const def = this._definitions.get(masterTypeId);
    if (!def || def.kind !== 'master') {
      this._noopMaster('setMasterCircuit', masterTypeId);
      return;
    }
    def.circuit = cloneCircuit(circuit);
    this._masterToSnapshotTypeId.delete(masterTypeId);
    this._recomputeDependencies(masterTypeId, circuit);
  }

  /**
   * The distinct master type ids behind the snapshots a circuit places,
   * resolved through the promotion alias. Built-ins contribute no edge.
   */
  private _recomputeDependencies(
    masterTypeId: number,
    circuit: SerializedCircuitBody
  ): void {
    const deps = new Set<number>();
    for (const c of circuit.components) {
      const childId = this._definitions.get(c.type)?.id;
      if (childId === undefined) continue;
      const dependencyMaster = this.masterTypeIdForId(childId);
      if (dependencyMaster !== undefined) deps.add(dependencyMaster);
    }
    this._dependencies.set(masterTypeId, deps);
    this.logging.debug(
      `dependencies for master ${masterTypeId}: {${[...deps].join(', ')}}`,
      'CustomComponentRegistry'
    );
  }

  /** Debug trail for a guard that no-ops on a non-master type id. */
  private _noopMaster(method: string, masterTypeId: number): void {
    this.logging.debug(
      `${method} no-op: type id ${masterTypeId} is unknown or not a master`,
      'CustomComponentRegistry'
    );
  }

  /**
   * Adopts the monotonic `version` a save returned. Snapshots placed afterwards
   * carry it as `source.version`, which is how a placed instance detects that
   * a newer version exists — the stamp is what makes existing instances
   * outdated, hence the {@link revision} bump.
   */
  public setMasterVersion(masterTypeId: number, version: number): void {
    const def = this._definitions.get(masterTypeId);
    if (!def || def.kind !== 'master') {
      this._noopMaster('setMasterVersion', masterTypeId);
      return;
    }
    def.version = version;
    this._masterToSnapshotTypeId.delete(masterTypeId);
    this._revision.update((r) => r + 1);
  }

  /** Last-edited time (epoch ms, default now); the palette sorts by it. */
  public setMasterLastEdited(masterTypeId: number, lastEdited?: number): void {
    const def = this._definitions.get(masterTypeId);
    if (!def || def.kind !== 'master') {
      this._noopMaster('setMasterLastEdited', masterTypeId);
      return;
    }
    def.lastEdited = lastEdited ?? Date.now();
    this._revision.update((r) => r + 1);
  }

  /**
   * Keeps a server master's share link and visibility fresh for the session.
   * No revision bump: share info is not palette-visible.
   */
  public setMasterShareInfo(
    masterTypeId: number,
    patch: { link?: string; isPublic?: boolean }
  ): void {
    const def = this._definitions.get(masterTypeId);
    if (!def || def.kind !== 'master') {
      this._noopMaster('setMasterShareInfo', masterTypeId);
      return;
    }
    if (patch.link !== undefined) def.link = patch.link;
    if (patch.isPublic !== undefined) def.isPublic = patch.isPublic;
  }

  public getDefinition(typeId: number): CustomComponentDefinition | undefined {
    return this._definitions.get(typeId);
  }

  /**
   * Masters-only reverse lookup, through the promotion alias chain: an id
   * captured before an upload-to-cloud still resolves to the server master.
   */
  public masterTypeIdForId(id: string): number | undefined {
    return this._idToMasterTypeId.get(this.currentIdForId(id));
  }

  /**
   * Records an old-id -> current-id alias, so promotions survive a reload.
   * Bumps the revision: readers that resolved before the aliases loaded must
   * re-resolve.
   */
  public registerIdAlias(oldId: string, newId: string): void {
    this._idAliases.set(oldId, newId);
    this._revision.update((r) => r + 1);
  }

  /**
   * Whether a browser master with this id was uploaded to the cloud, which
   * makes a surviving local record the residue of a failed promotion.
   */
  public isPromotedId(id: string): boolean {
    return this._idAliases.has(id);
  }

  /**
   * Re-points an orphaned snapshot at a freshly-restored master by stamping id,
   * origin and frozen `version`. The `version` is required: without both id and
   * version `collectSnapshots` drops the whole `source`, and the instance is
   * orphaned again on the next reload. No-op for a master or unknown type id.
   */
  public relinkSnapshotProvenance(
    snapshotTypeId: number,
    newId: string,
    version: number
  ): void {
    const def = this._definitions.get(snapshotTypeId);
    if (!def || def.kind !== 'snapshot') return;
    def.id = newId;
    def.source = 'browser';
    def.version = version;
    this._revision.update((r) => r + 1);
  }

  /**
   * The server id for a promoted browser id, the input unchanged otherwise.
   * Serialize paths write this rather than a snapshot's captured provenance id,
   * so a circuit saved after a dependency's upload references the cloud entry
   * and stays resolvable on a device with no local alias table.
   */
  public currentIdForId(id: string): string {
    let current = id;
    // Promotion is one-way, so the chain is a single hop; the cycle guard is
    // defensive.
    const seen = new Set<string>([current]);
    let next = this._idAliases.get(current);
    while (next !== undefined && !seen.has(next)) {
      seen.add(next);
      current = next;
      next = this._idAliases.get(current);
    }
    return current;
  }

  /**
   * A master resolves to itself, a snapshot follows its provenance id through
   * the promotion alias. Undefined for a built-in or unresolvable type id.
   */
  public resolveMaster(
    typeId: number
  ): { masterTypeId: number; master: CustomComponentDefinition } | undefined {
    const def = this._definitions.get(typeId);
    if (!def) return undefined;
    if (def.kind === 'master') return { masterTypeId: typeId, master: def };
    if (def.id === undefined) return undefined;
    const masterTypeId = this.masterTypeIdForId(def.id);
    if (masterTypeId === undefined) return undefined;
    const master = this._definitions.get(masterTypeId);
    return master ? { masterTypeId, master } : undefined;
  }

  /**
   * Promotes a browser master to the server library once its content is saved
   * server-side. The old id stays behind as an alias, so snapshots that
   * already captured it still resolve.
   */
  public promoteMaster(
    masterTypeId: number,
    newId: string,
    version: number,
    shareInfo?: { link?: string; isPublic?: boolean }
  ): void {
    const def = this._definitions.get(masterTypeId);
    if (!def || def.kind !== 'master') {
      this._noopMaster('promoteMaster', masterTypeId);
      return;
    }
    const oldId = def.id;
    if (oldId !== undefined) {
      this._idToMasterTypeId.delete(oldId);
      this._idAliases.set(oldId, newId);
    }
    def.source = 'server';
    def.id = newId;
    def.version = version;
    // Cloud identity brings a share link and a visibility with it.
    def.link = shareInfo?.link;
    def.isPublic = shareInfo?.isPublic;
    this._idToMasterTypeId.set(newId, masterTypeId);
    this._masterToSnapshotTypeId.delete(masterTypeId);
    this._provider.register(buildCustomComponentConfig(def));
    this._revision.update((r) => r + 1);
    this._change$.next(def);
  }

  /**
   * Removes a master from the session. Snapshots are untouched, so placed
   * instances keep rendering and merely stop resolving to a master — the same
   * state as any unloaded library entry. Promotion aliases are kept too, so a
   * master re-created under that id (a cloud preload after re-login) heals
   * them.
   */
  public removeMaster(masterTypeId: number): void {
    const def = this._definitions.get(masterTypeId);
    if (!def || def.kind !== 'master') {
      this._noopMaster('removeMaster', masterTypeId);
      return;
    }
    this._definitions.delete(masterTypeId);
    if (
      def.id !== undefined &&
      this._idToMasterTypeId.get(def.id) === masterTypeId
    ) {
      this._idToMasterTypeId.delete(def.id);
    }
    this._masterToSnapshotTypeId.delete(masterTypeId);
    this._dependencies.delete(masterTypeId);
    for (const deps of this._dependencies.values()) {
      deps.delete(masterTypeId);
    }
    this._provider.unregister(masterTypeId);
    this._revision.update((r) => r + 1);
  }

  /**
   * The library half of a logout: cloud palette entries disappear, except the
   * ones in `keepIds` that must stay live because an open editor's binding
   * writes into them. The next login's preload dedupes them by known id.
   */
  public removeServerMasters(keepIds: ReadonlySet<string>): void {
    for (const [typeId, def] of [...this._definitions]) {
      if (def.kind !== 'master' || def.source !== 'server') continue;
      if (def.id !== undefined && keepIds.has(def.id)) continue;
      this.removeMaster(typeId);
    }
  }

  /** A snapshot's `source.id` provenance, or a master's own id. */
  public idForTypeId(typeId: number): string | undefined {
    return this._definitions.get(typeId)?.id;
  }

  /** Records a master's direct library dependencies, for cycle prevention. */
  public setDependencies(masterTypeId: number, deps: Iterable<number>): void {
    this._dependencies.set(masterTypeId, new Set(deps));
  }

  /** The direct library dependencies of `masterTypeId`. */
  public dependenciesOf(masterTypeId: number): ReadonlySet<number> {
    return this._dependencies.get(masterTypeId) ?? new Set<number>();
  }

  /**
   * Transitive closure of masters depending on `masterTypeId`, excluding it.
   * Placing any of them inside its editor would close a cycle.
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
   * Whether placing `placedMasterTypeId` inside the editor for
   * `hostMasterTypeId` closes a dependency cycle: true if it is the host or
   * transitively depends on it. The one definition of "this placement cycles".
   */
  public wouldCycle(
    hostMasterTypeId: number,
    placedMasterTypeId: number
  ): boolean {
    return (
      placedMasterTypeId === hostMasterTypeId ||
      this.dependentsOf(hostMasterTypeId).has(placedMasterTypeId)
    );
  }

  /** Emits on a master's summary change; frozen snapshots never emit. */
  public definitionChange$(
    typeId: number
  ): Observable<CustomComponentDefinition> {
    return this._change$.pipe(filter((def) => def.typeId === typeId));
  }

  private _register(def: DefinitionInit): number {
    const full: CustomComponentDefinition = {
      ...def,
      typeId: this._nextTypeId++
    };
    this._store(full);
    return full.typeId;
  }

  /**
   * Indexes a definition whose type id is already allocated and registers its
   * config, so customs resolve through the same provider path as built-ins.
   * Masters surface in the USER palette; snapshots are HIDDEN.
   */
  private _store(def: CustomComponentDefinition): void {
    this._definitions.set(def.typeId, def);
    this._provider.register(buildCustomComponentConfig(def));
  }
}
