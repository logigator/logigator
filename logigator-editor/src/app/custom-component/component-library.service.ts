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
import {
  CustomComponentDefinition,
  CustomComponentDetails
} from '@logigator/core';
import { ComponentProviderService } from '../components/component-provider.service';

/**
 * Lifecycle of the custom-component library: hydrating the registry from the
 * browser and cloud stores at startup, the promotion alias map, lazy circuit
 * hydration for cloud masters, the logout teardown and orphan restore.
 * Document load and save stay with `PersistenceService` and its gateways.
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
   * Registers browser-stored masters into the registry so the palette shows
   * them at startup, skipping ones already there. Errors are caught per record
   * so one bad component does not block the rest.
   */
  async preloadBrowserMasters(): Promise<void> {
    const summaries = await this.browserComponentStore.list();
    await Promise.all(
      summaries.map(async ({ id }) => {
        if (this.registry.masterTypeIdForId(id) !== undefined) return;
        // A record whose id was promoted is stale: a promotion that uploaded
        // and aliased but failed to delete leaves one behind, and skipping it
        // keeps a single server master. Needs the alias map hydrated first.
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
   * Registers the signed-in user's cloud masters into the registry. No-op when
   * signed out. Runs once at startup, after {@link preloadComponentIdAliases}.
   */
  preloadServerMasters(): Promise<void> {
    return this.server.preloadServerMasters();
  }

  /**
   * The library half of a logout. A master backing an open server component
   * editor is kept: its `DefinitionBinding` writes into that type id, which
   * must stay live while the editor exists, and the next login's preload skips
   * known ids so nothing duplicates. Idempotent.
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
    // Retired session type ids make every cached body stale.
    this.server.clearMasterCircuitCache();
  }

  /**
   * Hydrates a preloaded server master's circuit the first time it is needed.
   * No-op for a master that is not server-sourced or is already loaded, so it
   * is safe to call repeatedly.
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
   * Hydrates the promotion alias map, so a component that embedded a master
   * before its upload still resolves it under the id promotion changed.
   * Best-effort: failures are logged, not thrown.
   */
  preloadComponentIdAliases(): Promise<void> {
    // Memoized, so the startup call and every login transition share one load
    // and the server preload cannot race ahead of the aliases.
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
   * Builds and registers a browser-library master from a snapshot's frozen
   * circuit. The store mints a fresh id at version 1 unless `options` reuses a
   * specific id — so placed instances re-link by themselves — and adopts the
   * snapshot's frozen version.
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
   * Deletes a master's persistent record: the browser store entry, or for a
   * cloud master the API, which unpublishes it and invalidates its share link.
   * Touches neither the session registry nor any open editor, so a failed
   * delete leaves everything intact for a retry.
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
   * Updates a master's descriptive metadata in its persistent record. Both
   * paths bump `version` — the details travel in placed snapshots, so frozen
   * instances can be offered an update — and re-stamp the edit time; both are
   * returned for the caller to mirror into the registry. Touches only the
   * record, so a failed persist leaves everything intact for a retry.
   */
  async updatePersistentMasterDetails(
    def: CustomComponentDefinition,
    details: CustomComponentDetails
  ): Promise<{ version?: number; lastEdited?: number }> {
    if (!def.id) return {};
    if (def.source === 'server') {
      return firstValueFrom(
        this.server.updateComponentDetails(def.id, details)
      );
    }
    const record = await this.browserComponentStore.updateDetails(
      def.id,
      details
    );
    return { version: record.version, lastEdited: record.lastEdited };
  }

  /**
   * Restores an orphaned custom — no master resolves for it, but its circuit is
   * still embedded — into the browser library at the snapshot's frozen version,
   * returning the new master's id or `null` when the type is not a restorable
   * orphan.
   *
   * The new master reuses the snapshot's provenance id only when that is a
   * browser-origin id, so placed instances re-link by themselves. An anonymous
   * or cloud-origin snapshot mints a fresh id and is re-pointed at it: reusing
   * a cloud uuid in the browser store would collide with the real cloud entry
   * once it reloads. The restore always lands in the browser library, so it
   * needs no login.
   */
  async restoreOrphanToLibrary(typeId: number): Promise<string | null> {
    const def = this.registry.getDefinition(typeId);
    if (!def || def.kind !== 'snapshot') return null;
    if (this.registry.resolveMaster(typeId)) return null;

    const reuseId = def.source === 'browser' ? def.id || undefined : undefined;
    const version = def.version ?? 1;
    const newId = await this._createMasterFromSnapshot(def, {
      id: reuseId,
      version
    });
    // A minted id re-points the snapshot, and its instances, at the new
    // master. The version goes with it: serialize needs both to emit
    // resolvable provenance, or the component re-orphans on reload.
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
