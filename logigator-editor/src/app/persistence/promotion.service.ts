import { inject, Injectable } from '@angular/core';
import { Location } from '@angular/common';
import { TranslationService } from '../translation/translation.service';
import { ToastService } from '../logging/toast.service';
import { LoggingService } from '../logging/logging.service';
import { Project } from '../project/project';
import { ProjectService } from '../project/project.service';
import { CircuitFileService } from './file/circuit-file.service';
import { BrowserProjectStore } from './browser/browser-project.store';
import { BrowserComponentStore } from './browser/browser-component.store';
import { ComponentIdMapStore } from './browser/component-id-map.store';
import { ProjectMetadataStore } from './project-metadata.store';
import { ServerPersistenceGateway } from './server/server-persistence.gateway';
import { CloudSessionService } from '../user/cloud-session.service';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { CUSTOM_TYPE_ID_BASE } from '../components/component-type.enum';
import type { SnapshotDefinition } from './serialized-circuit';
import { AuthRequiredError } from './persistence-errors';
import { buildProject } from './circuit-builder';
import { warnSkippedCustoms } from './load-warnings';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEvent } from '../analytics/analytics.mapping';

/**
 * One **local** custom component that a circuit about to be uploaded embeds
 * (transitively). `masterTypeId` is set when it is still a registered browser
 * master — those can be promoted to the cloud as their own library entries —
 * and `null` when the dependency only survives as an embedded snapshot copy.
 * Lists are ordered children-before-parents, so uploading resolvable entries
 * in order lets every later upload reference its already-promoted children.
 */
export interface LocalUploadDependency {
  name: string;
  masterTypeId: number | null;
}

/**
 * Moving documents from the browser store to the cloud: draft/project/
 * component promotion and the local-dependency queries that drive the
 * upload-to-cloud dialog. Every upload here is a **silent primitive** — no
 * toasts on success; `UploadCoordinatorService` sequences the uploads
 * (children first) and owns the outcome reporting. The whole story lives in
 * `docs/dependencies-and-promotion.md`.
 */
@Injectable({ providedIn: 'root' })
export class PromotionService {
  private readonly circuitFile = inject(CircuitFileService);
  private readonly browserStore = inject(BrowserProjectStore);
  private readonly browserComponentStore = inject(BrowserComponentStore);
  private readonly componentIdMapStore = inject(ComponentIdMapStore);
  private readonly registry = inject(CustomComponentRegistry);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly projectService = inject(ProjectService);
  private readonly server = inject(ServerPersistenceGateway);
  private readonly cloudSession = inject(CloudSessionService);
  private readonly toast = inject(ToastService);
  private readonly translation = inject(TranslationService);
  private readonly location = inject(Location);
  private readonly logging = inject(LoggingService);
  private readonly analytics = inject(AnalyticsService);

  /**
   * First save of a fresh draft to the **server**: creates the project record
   * and PUTs the current circuit (see
   * {@link ServerPersistenceGateway.promoteToServer}), then navigates to
   * `/project/:id`.
   */
  async saveDraftAsServer(
    project: Project,
    name: string,
    isPublic: boolean
  ): Promise<void> {
    this._requireSignedIn();
    const id = await this.server.promoteToServer(project, name, isPublic);
    this.location.go(`/project/${id}`);
    this.analytics.capture(AnalyticsEvent.ProjectUploaded, {
      kind: 'project',
      isPublic
    });
  }

  /**
   * Uploads an already-saved **local** project to the cloud — the project
   * analogue of component upload. Promotes the live project (preserving its
   * circuit + undo history and its embedded custom snapshots), navigates to
   * `/project/:id`, then deletes the now-orphaned browser record so the project
   * *moves* to the cloud rather than being copied. Rejects a project that is not
   * a stored browser project (a fresh draft goes through the save-draft flow).
   */
  async promoteProjectToServer(
    project: Project,
    isPublic: boolean
  ): Promise<void> {
    const metadata = this.metadataStore.getMetadata(project);
    if (
      !metadata ||
      metadata.type !== 'project' ||
      metadata.source !== 'browser' ||
      !metadata.id
    ) {
      throw new Error('Not a stored local project');
    }
    this._requireSignedIn();
    const oldId = metadata.id;

    // The server round-trip is the only fail-able, irreversible step. Until it
    // returns, nothing local has changed and the upload can be retried.
    await this.server.promoteToServer(project, metadata.name, isPublic);
    this.location.go(`/project/${this.metadataStore.getMetadata(project)!.id}`);

    // Now cloud-backed — drop the orphaned browser record so the project moves
    // to the cloud rather than being copied.
    await this._dropBrowserProjectRecord(oldId);
    this.analytics.capture(AnalyticsEvent.ProjectUploaded, {
      kind: 'project',
      isPublic
    });
  }

  /**
   * Uploads a browser project by its store id, which may be a project other than
   * the currently open one (the Open dialog's local list). When the id is the
   * open main project it delegates to {@link promoteProjectToServer} so the live
   * state (including unsaved edits) and metadata flip are used; otherwise it
   * uploads a throwaway project built from the stored record and deletes that
   * record on success (a *move*, mirroring {@link promoteComponentToServer}).
   */
  async uploadStoredProjectToServer(
    id: string,
    isPublic: boolean
  ): Promise<void> {
    this._requireSignedIn();
    const main = this.projectService.mainProject();
    if (main && this.metadataStore.getMetadata(main)?.id === id) {
      await this.promoteProjectToServer(main, isPublic);
      return;
    }

    const record = await this.browserStore.get(id);
    if (!record) throw new Error(`No browser project with id ${id}`);

    // Upload first (the only fail-able step); build the throwaway project only to
    // serialize it, and always tear it down.
    await this._withProjectFromContent(record.content, (temp) =>
      this.server.createServerProjectFromProject(temp, record.name, isPublic)
    );

    // Uploaded — drop the local record so the project moves to the cloud.
    await this._dropBrowserProjectRecord(id);
    // The delegating main-project branch above returns early, captured by
    // promoteProjectToServer; only this stored-record path reaches here.
    this.analytics.capture(AnalyticsEvent.ProjectUploaded, {
      kind: 'project',
      isPublic
    });
  }

  /**
   * Uploads (moves) a **browser** master to the server library: creates the server
   * record and pushes its circuit (embedding a self-contained copy of every custom
   * it places), flips the registry to the new server id while keeping the old id
   * as an alias, persists that alias, then removes the browser record. The master
   * keeps its session type id, so placed instances and the palette tile survive —
   * the tile's indicator just flips to "cloud". Rejects if the master is not a
   * local component or its stored record is missing.
   */
  async promoteComponentToServer(
    masterTypeId: number,
    isPublic = false
  ): Promise<void> {
    const def = this.registry.getDefinition(masterTypeId);
    if (!def || def.kind !== 'master' || def.source !== 'browser' || !def.id) {
      throw new Error('Not a local component');
    }
    this._requireSignedIn();
    const oldId = def.id;
    const record = await this.browserComponentStore.get(oldId);
    if (!record) {
      throw new Error(`No browser component with id ${oldId}`);
    }

    // Upload to the server first — the only irreversible, fail-able step. If it
    // throws, nothing local has changed: the master is still browser-sourced, the
    // record is intact and the upload button stays visible for a retry.
    const {
      id: newId,
      version,
      hash: newHash,
      link: newLink,
      isPublic: newIsPublic
    } = await this._withProjectFromContent(record.content, (temp) =>
      this.server.promoteComponentFromProject(temp, {
        name: def.name,
        symbol: def.symbol,
        description: def.description,
        isPublic
      })
    );

    // The component now lives in the cloud — past the point of no return. Persist
    // the durable old→new alias and drop the local record *before* the in-memory
    // flip, so a reload stays consistent even if interrupted here. These local
    // writes must not fail the operation: the upload already succeeded, so
    // surfacing an error would be a lie (and would hide the now-disabled retry).
    // A failure here self-heals on reload — the browser preload ignores a record
    // whose id has been promoted (see ComponentLibraryService.preloadBrowserMasters
    // / isPromotedId).
    try {
      await this.componentIdMapStore.put(oldId, newId);
      await this.browserComponentStore.delete(oldId);
    } catch {
      this.logging.warn(
        `Component ${oldId} uploaded to the cloud, but local cleanup failed`,
        'PromotionService'
      );
    }

    this.registry.promoteMaster(masterTypeId, newId, version, {
      link: newLink,
      isPublic: newIsPublic
    });
    this.analytics.capture(AnalyticsEvent.ProjectUploaded, {
      kind: 'component',
      isPublic
    });
    this.logging.info(
      `Promoted component ${oldId} -> ${newId} (v${version})`,
      'PromotionService'
    );
    // If the master's own editor tab is open, flip its metadata to the new server
    // identity so a later save routes to the cloud instead of re-creating the
    // browser record that was just deleted.
    this._reconcilePromotedEditor(oldId, newId, newHash);
  }

  /**
   * The **local** custom components a browser master embeds (transitively).
   * Read straight from the master's stored record — the transitive closure is
   * already baked in at save time — without building a live project or ingesting
   * throwaway definitions into the registry. Empty for a server master or one
   * with no local dependencies. Drives the upload-to-cloud dialog.
   */
  async localDependencies(
    masterTypeId: number
  ): Promise<LocalUploadDependency[]> {
    const def = this.registry.getDefinition(masterTypeId);
    if (!def || def.kind !== 'master' || !def.id) return [];
    const record = await this.browserComponentStore.get(def.id);
    if (!record) return [];
    return this._classifyLocalDependencies(
      this._depsFromFileDefinitions(
        this.circuitFile.peekDefinitions(record.content)
      )
    );
  }

  /**
   * The **local** custom components a live project places (transitively) —
   * the project analogue of {@link localDependencies}, walked over the registry
   * definitions of the placed snapshots so unsaved edits are reflected.
   */
  localDependenciesOfProject(project: Project): LocalUploadDependency[] {
    const entries: { name: string; sourceId?: string }[] = [];
    const visited = new Set<number>();
    // Post-order DFS: a definition is emitted only after everything it places,
    // so the result is children-before-parents (the upload order — a parent's
    // snapshot then references its already-promoted children).
    const visit = (typeId: number): void => {
      if (visited.has(typeId)) return;
      visited.add(typeId);
      const def = this.registry.getDefinition(typeId);
      if (!def) return; // built-in
      for (const c of def.circuit?.components ?? []) visit(c.type);
      entries.push({ name: def.name, sourceId: def.id });
    };
    for (const component of project.components) {
      visit(component.config.type);
    }
    return this._classifyLocalDependencies(entries);
  }

  /**
   * The **local** custom components a stored browser project embeds
   * (transitively), read from its record like {@link localDependencies}. When
   * `id` is the currently open main project it walks the live project instead
   * (mirroring {@link uploadStoredProjectToServer}, which uploads the live
   * state), so unsaved edits are reflected. Rejects if no record exists.
   */
  async localDependenciesOfStoredProject(
    id: string
  ): Promise<LocalUploadDependency[]> {
    const main = this.projectService.mainProject();
    if (main && this.metadataStore.getMetadata(main)?.id === id) {
      return this.localDependenciesOfProject(main);
    }
    const record = await this.browserStore.get(id);
    if (!record) throw new Error(`No browser project with id ${id}`);
    return this._classifyLocalDependencies(
      this._depsFromFileDefinitions(
        this.circuitFile.peekDefinitions(record.content)
      )
    );
  }

  /**
   * Orders embedded file definitions children-before-parents via a post-order
   * DFS over their inter-definition references (each definition's body places
   * others by file-local type id). `peekDefinitions` yields them
   * ancestors-first (collect order), which reversed is *not* a valid topological
   * order once a dependency is shared, so the graph is walked explicitly.
   */
  private _depsFromFileDefinitions(
    defs: SnapshotDefinition[]
  ): { name: string; sourceId?: string }[] {
    const byLocalType = new Map<number, SnapshotDefinition>();
    for (const def of defs) byLocalType.set(def.type, def);

    const ordered: SnapshotDefinition[] = [];
    const visited = new Set<number>();
    const visit = (localType: number): void => {
      if (visited.has(localType)) return;
      visited.add(localType);
      const def = byLocalType.get(localType);
      if (!def) return;
      for (const c of def.components) {
        if (c.type >= CUSTOM_TYPE_ID_BASE) visit(c.type);
      }
      ordered.push(def);
    };
    for (const def of defs) visit(def.type);

    return ordered.map((def) => ({ name: def.name, sourceId: def.source?.id }));
  }

  /**
   * Shared tail of the dependency queries: classifies embedded definitions —
   * already in children-before-parents order — into {@link LocalUploadDependency}s,
   * preserving that order (which the coordinator uploads in). Server-sourced
   * entries are omitted (already in the cloud — resolution goes through the
   * promotion alias, so a dependency uploaded earlier drops out even when the
   * document still references its old id), and the list is deduplicated per
   * master (several snapshots of one master — e.g. frozen at different versions —
   * are one dependency; the first, deepest occurrence wins).
   */
  private _classifyLocalDependencies(
    entries: { name: string; sourceId?: string }[]
  ): LocalUploadDependency[] {
    const seen = new Set<string>();
    const deps: LocalUploadDependency[] = [];
    for (const entry of entries) {
      const masterTypeId =
        entry.sourceId !== undefined
          ? this.registry.masterTypeIdForId(entry.sourceId)
          : undefined;
      const master =
        masterTypeId !== undefined
          ? this.registry.getDefinition(masterTypeId)
          : undefined;
      // Already in the cloud — its copy is fine, nothing local to mention.
      if (master?.source === 'server') continue;
      const key =
        masterTypeId !== undefined
          ? `master:${masterTypeId}`
          : `orphan:${entry.sourceId ?? entry.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deps.push({
        name: master?.name ?? entry.name,
        masterTypeId:
          master?.source === 'browser' && masterTypeId !== undefined
            ? masterTypeId
            : null
      });
    }
    return deps;
  }

  /**
   * After a master is promoted to the cloud, re-points an open editor tab for it
   * (matched by the old browser id) to the new server identity, so closing/saving
   * that editor routes to the server save path rather than resurrecting the
   * deleted browser record. No-op when no such editor is open.
   */
  private _reconcilePromotedEditor(
    oldId: string,
    newId: string,
    hash: string
  ): void {
    const handle = this.metadataStore.getHandleById(oldId);
    if (
      handle?.metadata.type === 'comp' &&
      handle.metadata.source === 'browser'
    ) {
      this.metadataStore.update(handle.project, {
        source: 'server',
        id: newId,
        hash
      });
    }
  }

  /**
   * Rejects creating a *new* cloud record (create / promote / upload) while
   * signed out — the proactive counterpart to the 401 the API would return.
   * Toasts once and throws the marker error the outer flows recognize as
   * already surfaced (see `isHandledSaveError`).
   */
  private _requireSignedIn(): void {
    if (this.cloudSession.isSignedIn()) return;
    this.toast.error(
      this.translation.translate('session.saveLoggedOut'),
      'PromotionService'
    );
    throw new AuthRequiredError();
  }

  /**
   * Builds a throwaway project from stored circuit JSON, runs `fn` on it (a
   * serialize-and-upload step), and always tears the project down. Shared by
   * the upload paths that push a stored record without opening it.
   */
  private async _withProjectFromContent<T>(
    content: string,
    fn: (project: Project) => Promise<T>
  ): Promise<T> {
    const { components, wires, skippedCustom } =
      this.circuitFile.fromJson(content);
    warnSkippedCustoms(
      this.toast,
      this.translation,
      skippedCustom,
      'PromotionService'
    );
    const temp = buildProject(components, wires);
    try {
      return await fn(temp);
    } finally {
      temp.destroy();
    }
  }

  /**
   * Deletes a browser project record after its content has been uploaded to the
   * cloud, so the project *moves* rather than being copied. Best-effort: the
   * upload already committed, so a cleanup failure is logged, not surfaced.
   */
  private async _dropBrowserProjectRecord(id: string): Promise<void> {
    try {
      await this.browserStore.delete(id);
    } catch {
      this.logging.warn(
        `Project ${id} uploaded to the cloud, but local cleanup failed`,
        'PromotionService'
      );
    }
  }
}
