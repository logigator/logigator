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
  private readonly logging = inject(LoggingService);

  private _nextTypeId = CUSTOM_TYPE_ID_BASE;
  private readonly _definitions = new Map<number, CustomComponentDefinition>();
  // Masters only: persistent id -> masterTypeId. Snapshots are excluded — one id
  // maps to many snapshot type ids, so the reverse lookup is masters-only.
  private readonly _idToMasterTypeId = new Map<string, number>();
  // Old (pre-promotion) id -> current id. A master promoted browser->server keeps
  // its old local id here so snapshots that captured it still resolve to the
  // now-server master. Populated live by promoteMaster and at startup from the
  // persistent id-map (registerIdAlias).
  private readonly _idAliases = new Map<string, string>();
  // Library dependency edges: masterTypeId -> the distinct master type ids its
  // circuit places. Reverse-traversed by dependentsOf for cycle filtering.
  private readonly _dependencies = new Map<number, Set<number>>();
  // Placement-time snapshot cache: masterTypeId -> the snapshot type id that
  // represents the master's current state. Cleared by any method that mutates
  // master content so subsequent placements get a fresh snapshot.
  private readonly _masterToSnapshotTypeId = new Map<number, number>();
  private readonly _change$ = new Subject<CustomComponentDefinition>();
  // Bumped on mutations that change a master's palette-visible metadata: its
  // identity/source (promotion) or its last-edited time (a save). Lets
  // signal-based readers (the settings panel chip + upload button, the palette's
  // newest-first ordering) recompute after such a change.
  private readonly _revision = signal(0);
  /**
   * Increments whenever a master is promoted or re-stamped as edited; a
   * dependency for reactive readers.
   */
  public readonly revision = this._revision.asReadonly();

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
      link: meta.link,
      isPublic: meta.isPublic,
      // A master without a supplied timestamp is one being created now, so it
      // sorts to the top of the palette; preloads pass the persisted value.
      lastEdited: meta.lastEdited ?? Date.now(),
      circuit: meta.circuit ? cloneCircuit(meta.circuit) : undefined
    });
    this._idToMasterTypeId.set(id, typeId);
    return typeId;
  }

  /**
   * Freezes a master's **current** state into a snapshot definition (with
   * `source`/`id`/`version` provenance) and returns it. Repeated calls for the
   * same unchanged master return the cached snapshot so all placements share one
   * type id and produce one definition in the save file. The cache is invalidated
   * by {@link updateDefinition}, {@link setMasterCircuit}, and
   * {@link setMasterVersion} — any of which mutate master content — so the next
   * call after an edit always produces a fresh snapshot.
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
      // Deep-copy: a frozen snapshot must never share circuit state with its
      // master, so later edits to the master cannot mutate placed instances.
      circuit: master.circuit ? cloneCircuit(master.circuit) : undefined
    });
    this._masterToSnapshotTypeId.set(masterTypeId, typeId);
    return this._definitions.get(typeId)!;
  }

  /**
   * Registers one frozen snapshot definition and returns its fresh type id. The
   * lower-level primitive behind {@link snapshot}. Not added to the masters id
   * index.
   */
  public registerSnapshot(def: DefinitionInit): number {
    return this._register(def);
  }

  /**
   * Registers a document's embedded snapshots (the universal load path for file,
   * browser, and server-new-client) and returns the `fileLocalType → sessionType`
   * remap the caller applies to the document body.
   *
   * Two passes so nested references resolve: pass 1 allocates a session type id
   * per incoming definition; pass 2 registers each, rewriting the type ids inside
   * its own circuit body from file-local to session. The stored circuit therefore
   * holds post-remap session ids, so re-saving or opening it resolves correctly
   * (the id-space rule). Snapshots carry provenance + circuit but are not added to
   * the masters id index.
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
        // Record the master's library origin (server vs browser) when the
        // document carried it, so an orphaned instance can be recovered
        // correctly; default to 'browser' for older documents that omit it.
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
    // Pre-populate the placement cache for ingested snapshots whose source
    // matches a currently-loaded library master at the same version. This
    // ensures that palette placements after loading an existing project reuse
    // the ingested type id instead of creating a duplicate definition on save.
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
   * Materialises a **master's** own circuit (from its open editor — see
   * `DefinitionBinding` — or a lazily-fetched cloud circuit). Replaces `circuit`
   * with a fresh deep copy rather than mutating in place, so snapshots taken
   * earlier (which copied the previous object) stay frozen, and recomputes the
   * master's direct library dependencies from the new circuit so cycle detection
   * stays correct for any path that sets a circuit (not just an open editor).
   * No-ops for a snapshot or unknown type id.
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
   * Derives a master's direct library dependencies (the distinct master type ids
   * behind the custom snapshots its circuit places, resolved through the promotion
   * alias) and records them for cycle prevention. Built-ins (no registry def) and
   * unresolvable types contribute no edge.
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

  /** Debug trail for a guard that no-ops on an unknown or non-master type id. */
  private _noopMaster(method: string, masterTypeId: number): void {
    this.logging.debug(
      `${method} no-op: type id ${masterTypeId} is unknown or not a master`,
      'CustomComponentRegistry'
    );
  }

  /**
   * Adopts the monotonic `version` a save returned for a **master** (the
   * save-time stamp; {@link updateDefinition} deliberately leaves it alone).
   * Snapshots placed afterwards carry it as `source.version`, so a placed
   * instance can detect "a newer version exists". Bumps {@link revision}: the
   * stamp is what makes already-placed instances outdated, which the settings
   * panel's update actions and the palette's outdated indicator read. No-ops for
   * a snapshot or unknown type id.
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

  /**
   * Records a **master's** last-edited time (epoch ms; defaults to now) so the
   * palette re-sorts it to the top after a save. Bumps {@link revision} to notify
   * the signal-based ordering. No-ops for a snapshot or unknown type id.
   */
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
   * Updates a **server master's** share link and/or public visibility after the
   * share dialog mutates them, so the value stays fresh for the rest of the
   * session (the dialog reads it back without a fetch). No revision bump — share
   * info is not palette-visible. No-ops for a snapshot or unknown type id.
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
   * Masters-only reverse lookup: persistent id -> masterTypeId. Resolves through
   * the promotion alias chain first (via {@link currentIdForId}), so an id
   * captured before an upload-to-cloud still resolves to the (now-server) master
   * under its current id.
   */
  public masterTypeIdForId(id: string): number | undefined {
    return this._idToMasterTypeId.get(this.currentIdForId(id));
  }

  /**
   * Records an old-id -> current-id alias (idempotent). Used at startup to hydrate
   * the alias map from the persistent id-map so promotions survive a reload. Bumps
   * the revision so signal readers that resolved before the aliases loaded
   * re-resolve once they are in place.
   */
  public registerIdAlias(oldId: string, newId: string): void {
    this._idAliases.set(oldId, newId);
    this._revision.update((r) => r + 1);
  }

  /**
   * Whether `id` is a recorded pre-promotion (old) id — i.e. a browser master
   * with this id was uploaded to the cloud. The startup browser preload uses this
   * to ignore a stale local record left behind by a partially-failed promotion.
   */
  public isPromotedId(id: string): boolean {
    return this._idAliases.has(id);
  }

  /**
   * Re-points an orphaned **snapshot** at a freshly-restored master by stamping
   * its full provenance — id, browser origin, and frozen `version`. Used when the
   * snapshot had no reusable id of its own (an anonymous/no-provenance local
   * custom), so the placed instances resolve to the new master. The `version` is
   * required: `collectSnapshots` drops the whole `source` (⇒ empty server mapping
   * id ⇒ re-orphaned on reload) unless both id and version are present, and a
   * no-provenance orphan is ingested with `version` undefined. Bumps the revision
   * so signal readers (the settings panel chip / actions) re-resolve. No-op for a
   * master or unknown type id.
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
   * Resolves an id through the promotion alias map to its current value — the
   * server id for a promoted browser id, the input unchanged otherwise. Serialize
   * paths write this instead of a snapshot's captured provenance id, so a circuit
   * saved after a dependency's upload references the cloud entry (and stays
   * resolvable on other devices, where the local alias table does not exist).
   */
  public currentIdForId(id: string): string {
    let current = id;
    // Promotion is one-way (browser -> server), so the chain is a single hop
    // today; walk defensively with a cycle guard anyway.
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
   * Resolves any custom type id to its master entry: a master returns itself, a
   * snapshot follows its provenance id (through the promotion alias). Returns
   * undefined for a built-in, unknown, or unresolvable type id.
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
   * Promotes a **browser** master to the server library after its content has
   * been saved server-side: flips `source`/`id`/`version`, re-points the masters
   * id index to the new id while keeping the old id as an alias (so snapshots that
   * already captured it still resolve), invalidates the placement-snapshot cache,
   * re-registers the config (so the palette reflects the new source) and bumps the
   * revision. No-op for a snapshot or unknown type id.
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
    // The component gained its cloud identity, hence its share link + visibility.
    def.link = shareInfo?.link;
    def.isPublic = shareInfo?.isPublic;
    this._idToMasterTypeId.set(newId, masterTypeId);
    this._masterToSnapshotTypeId.delete(masterTypeId);
    this._provider.register(buildCustomComponentConfig(def));
    this._revision.update((r) => r + 1);
    this._change$.next(def);
  }

  /**
   * Removes a **master** from the session: definition, masters id index,
   * placement-snapshot cache, dependency edges, and its palette config
   * (provider unregister — the USER category updates reactively). Snapshots are
   * untouched, so placed instances keep rendering; they merely stop resolving
   * to a master (the same state as any unloaded library entry). Promotion
   * aliases pointing at the removed id are kept — they resolve to an id with no
   * master, which reads as "unloaded" and heals when the master is re-created
   * under that id (e.g. the cloud preload after a re-login). No-op for a
   * snapshot or unknown type id.
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
   * Removes every **server** master except those whose persistent id is in
   * `keepIds` — the library half of a logout: the signed-out user's cloud
   * palette entries disappear, while masters that must stay live (an open
   * editor's binding writes into them) are kept and deduped against the next
   * login's preload by the usual known-id skip.
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
   * Whether placing master `placedMasterTypeId` inside the editor for master
   * `hostMasterTypeId` would close a dependency cycle — true if it *is* the host
   * or (transitively) depends on it. The single definition of "this placement
   * cycles", shared by the palette filter and the placement-time guard ([§H]).
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
    const full: CustomComponentDefinition = {
      ...def,
      typeId: this._nextTypeId++
    };
    this._store(full);
    return full.typeId;
  }

  /**
   * Indexes a fully-formed definition (its type id already allocated) and
   * registers the matching config so the serializer/actions/palette resolve this
   * custom type through the same provider path as built-ins. Masters surface in
   * the USER palette; snapshots are HIDDEN (resolvable, not listed).
   */
  private _store(def: CustomComponentDefinition): void {
    this._definitions.set(def.typeId, def);
    this._provider.register(buildCustomComponentConfig(def));
  }
}
