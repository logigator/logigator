import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LoggingService } from '../logging/logging.service';
import { CircuitFileService } from '../persistence/file/circuit-file.service';
import { BrowserComponentStore } from '../persistence/browser/browser-component.store';
import { ComponentIdMapStore } from '../persistence/browser/component-id-map.store';
import { ServerPersistenceGateway } from '../persistence/server/server-persistence.gateway';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { buildProject, instantiateBody } from '../persistence/circuit-builder';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { CustomComponentDefinition } from '../components/custom/custom-component-definition.model';
import { ComponentProviderService } from '../components/component-provider.service';

/**
 * Lifecycle of the custom-component **library**: hydrating the registry from
 * the browser and cloud stores at startup, the promotion alias map, lazy
 * circuit hydration for cloud masters, the logout teardown, and recovering
 * masters from embedded snapshots (orphan restore). Document load/save stays
 * with `PersistenceService` and its gateways.
 */
@Injectable({ providedIn: 'root' })
export class ComponentLibraryService {
  private readonly circuitFile = inject(CircuitFileService);
  private readonly browserComponentStore = inject(BrowserComponentStore);
  private readonly componentIdMapStore = inject(ComponentIdMapStore);
  private readonly registry = inject(CustomComponentRegistry);
  private readonly provider = inject(ComponentProviderService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly server = inject(ServerPersistenceGateway);
  private readonly logging = inject(LoggingService);

  private _aliasesLoaded: Promise<void> | undefined;

  /**
   * Registers all browser-stored custom component masters into the registry so
   * the palette shows them at startup. Masters already in the registry (loaded
   * by a prior project open) are skipped. Errors are caught per-component so
   * one bad record does not prevent the rest from loading.
   */
  async preloadBrowserMasters(): Promise<void> {
    const summaries = await this.browserComponentStore.list();
    await Promise.all(
      summaries.map(async ({ id }) => {
        if (this.registry.masterTypeIdForId(id) !== undefined) return;
        // A record whose id was promoted to the cloud is stale — its component
        // moved to the server library. This guards the case where a previous
        // promotion uploaded + aliased the component but failed to delete the
        // local record; ignoring it here keeps a single (server) master. Relies
        // on the alias map being hydrated first (see app startup ordering).
        if (this.registry.isPromotedId(id)) return;
        try {
          const record = await this.browserComponentStore.get(id);
          if (!record) return;
          const circuit = this.circuitFile.decodeToBody(record.content);
          this.registry.createMaster(
            {
              id: record.id,
              version: record.version,
              name: record.name,
              symbol: record.symbol,
              description: record.description,
              numInputs: record.numInputs,
              numOutputs: record.numOutputs,
              labels: record.labels,
              lastEdited: record.lastEdited,
              circuit
            },
            'browser'
          );
        } catch {
          this.logging.warn(
            `Failed to preload browser component ${id}`,
            'ComponentLibraryService'
          );
        }
      })
    );
  }

  /**
   * Registers all of the signed-in user's cloud library masters into the registry
   * at startup (so they appear in the palette and resolve through the promotion
   * alias after a reload). Delegates to the server gateway; a no-op when signed
   * out. Call once at startup, after {@link preloadComponentIdAliases}.
   */
  preloadServerMasters(): Promise<void> {
    return this.server.preloadServerMasters();
  }

  /**
   * Removes the signed-out user's cloud masters from the registry and palette —
   * the library half of any logout (initiated or external). Masters that back a
   * currently open server component editor are kept: their `DefinitionBinding`
   * writes into the master's type id, which must stay live while the editor
   * exists (the next login's preload skips known ids, so a kept master dedupes
   * instead of duplicating). Placed instances are frozen snapshots and keep
   * rendering regardless. Idempotent.
   */
  clearServerMasters(): void {
    const openEditorIds = new Set(
      this.metadataStore
        .getAllHandles()
        .filter(
          (h) => h.metadata.type === 'comp' && h.metadata.source === 'server'
        )
        .map((h) => h.metadata.id)
    );
    this.registry.removeServerMasters(openEditorIds);
    // Retired session type ids make any cached body stale; drop the whole cache.
    this.server.clearMasterCircuitCache();
  }

  /**
   * Lazily hydrates a preloaded server master's circuit (GET `/api/component/:id`)
   * the first time it is needed — placement or update-to-latest. No-op for a master
   * that is not server-sourced or whose circuit is already loaded. Safe to call
   * repeatedly; only the first call for a given master fetches.
   */
  async ensureServerMasterCircuit(masterTypeId: number): Promise<void> {
    const def = this.registry.getDefinition(masterTypeId);
    if (
      !def ||
      def.kind !== 'master' ||
      def.source !== 'server' ||
      !def.id ||
      def.circuit
    ) {
      return;
    }
    const circuit = await this.server.loadComponentCircuit(def.id);
    this.registry.setMasterCircuit(masterTypeId, circuit);
  }

  /**
   * Hydrates the registry's promotion alias map from the persistent id-map so
   * components that embedded a master before it was uploaded to the cloud still
   * resolve it (its id changed on promotion). Call once at startup, alongside
   * {@link preloadBrowserMasters}. Best-effort: failures are logged, not thrown.
   */
  preloadComponentIdAliases(): Promise<void> {
    // Memoized: called once at startup and again by every login transition
    // (the server preload must not race ahead of the aliases), so all callers
    // share one load.
    return (this._aliasesLoaded ??= this._loadComponentIdAliases());
  }

  private async _loadComponentIdAliases(): Promise<void> {
    try {
      const mappings = await this.componentIdMapStore.list();
      for (const { id, newId } of mappings) {
        this.registry.registerIdAlias(id, newId);
      }
    } catch {
      this.logging.warn(
        'Failed to load component id aliases',
        'ComponentLibraryService'
      );
    }
  }

  /**
   * Builds a browser-library master from a snapshot definition's frozen circuit
   * (its own nested snapshots re-emitted as self-contained content) and registers
   * it, returning the new master's id. By default the store mints a fresh id at
   * version 1; `options` can reuse a specific id (so placed instances re-link
   * with no extra work) and adopt the snapshot's frozen version.
   */
  private async _createMasterFromSnapshot(
    def: CustomComponentDefinition,
    options?: { id?: string; version?: number }
  ): Promise<string> {
    const circuit = def.circuit ?? { components: [], wires: [] };
    const { components, wires } = instantiateBody(this.provider, circuit);
    const tmp = buildProject(components, wires);
    let content: string;
    try {
      content = this.circuitFile.toJson(tmp, def.name);
    } finally {
      tmp.destroy();
    }

    const summary = {
      version: options?.version ?? 1,
      name: def.name,
      symbol: def.symbol,
      description: def.description,
      numInputs: def.numInputs,
      numOutputs: def.numOutputs,
      labels: def.labels
    };
    const record = await this.browserComponentStore.save({
      id: options?.id,
      ...summary,
      content
    });
    this.registry.createMaster(
      { id: record.id, ...summary, lastEdited: record.lastEdited, circuit },
      'browser'
    );
    return record.id;
  }

  /**
   * Deletes a library master's **persistent** record — the browser store entry, or
   * for a cloud master the API (unpublishing it and invalidating its share link).
   * A no-op for a master without a persistent id. Touches neither the session
   * registry nor any open editor: the caller ({@link CustomComponentService}) runs
   * {@link CustomComponentRegistry.removeMaster} and closes the tab only after this
   * resolves, so a failed delete leaves everything intact for a retry. Placed
   * instances are frozen snapshots and keep rendering as embedded copies once the
   * master is gone.
   */
  async deletePersistentMaster(def: CustomComponentDefinition): Promise<void> {
    if (!def.id) return;
    if (def.source === 'server') {
      await firstValueFrom(this.server.deleteComponent(def.id));
    } else {
      await this.browserComponentStore.delete(def.id);
    }
  }

  /**
   * Restores an **orphaned** custom instance — one whose master can no longer be
   * resolved in any library, though its circuit is still embedded — into the
   * browser library, so the user can edit it again. Builds a browser master from
   * the frozen snapshot's circuit (at its frozen version) and returns the new
   * master's id, or `null` when the type is not a restorable orphan.
   *
   * Re-linking: the new master reuses the snapshot's own provenance id only when
   * it is a **browser**-origin id, so every placed instance that references it
   * resolves to the new master with no further change. An anonymous snapshot (no
   * id) or a **cloud**-origin one mints a fresh id and the snapshot is re-pointed
   * at it — reusing a cloud uuid in the browser store would collide with the real
   * cloud entry once it reloads. Always restores to the **browser** library — no
   * login required. The caller decides *whether* to offer this (a lost cloud
   * master while signed out is likely just unloaded, not deleted).
   */
  async restoreOrphanToLibrary(typeId: number): Promise<string | null> {
    const def = this.registry.getDefinition(typeId);
    if (!def || def.kind !== 'snapshot') return null;
    // Already resolvable ⇒ not an orphan; nothing to restore.
    if (this.registry.resolveMaster(typeId)) return null;

    const reuseId = def.source === 'browser' ? def.id || undefined : undefined;
    const version = def.version ?? 1;
    const newId = await this._createMasterFromSnapshot(def, {
      id: reuseId,
      version
    });
    // A fresh id was minted (anonymous or cloud-origin snapshot): re-point it
    // (and thus its instances) at the new master. Stamp the master's version too:
    // a no-provenance orphan has none, and serialize needs both id and version to
    // emit resolvable provenance (else it re-orphans on reload).
    if (def.id !== newId) {
      this.registry.relinkSnapshotProvenance(typeId, newId, version);
    }
    this.logging.info(
      `Restored orphan component ${def.name} -> ${newId}`,
      'ComponentLibraryService'
    );
    return newId;
  }
}
