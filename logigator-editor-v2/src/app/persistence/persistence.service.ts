import { inject, Injectable } from '@angular/core';
import { Location } from '@angular/common';
import { Observable } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { CircuitFileService } from './file/circuit-file.service';
import { BrowserProjectStore } from './browser/browser-project.store';
import { BrowserComponentStore } from './browser/browser-component.store';
import { ComponentIdMapStore } from './browser/component-id-map.store';
import {
  BrowserComponentSummary,
  BrowserProjectSummary
} from './browser/browser-project.types';
import { ProjectMetadataStore } from './project-metadata.store';
import { ProjectService } from '../project/project.service';
import { ToastService } from '../logging/toast.service';
import { LoggingService } from '../logging/logging.service';
import { Project } from '../project/project';
import { ProjectSummary } from '../api/models/project';
import { Page } from '../api/models/shared';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { CustomComponentDefinition } from '../components/custom/custom-component-definition.model';
import { ComponentProviderService } from '../components/component-provider.service';
import { deriveSummary } from '../custom-component/definition-derivation';
import { DefinitionBinding } from '../custom-component/definition-binding';
import { buildProject, instantiateBody } from './circuit-builder';
import { CUSTOM_TYPE_ID_BASE } from '../components/component-type.enum';
import type { SnapshotDefinition } from './serialized-circuit';
import { formatHttpError } from './persistence-errors';
import { ServerPersistenceGateway } from './server/server-persistence.gateway';
import { downloadBlob } from '../utils/download';
import { ProjectDump, PROJECT_DUMP_VERSION } from './dump/project-dump.types';
import { deserializeAction } from '../actions/action-codec';

export { AuthRequiredError } from './persistence-errors';

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

@Injectable({ providedIn: 'root' })
export class PersistenceService {
  private readonly circuitFile = inject(CircuitFileService);
  private readonly browserStore = inject(BrowserProjectStore);
  private readonly browserComponentStore = inject(BrowserComponentStore);
  private readonly componentIdMapStore = inject(ComponentIdMapStore);
  private readonly registry = inject(CustomComponentRegistry);
  private readonly provider = inject(ComponentProviderService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly projectService = inject(ProjectService);
  private readonly toast = inject(ToastService);
  private readonly logging = inject(LoggingService);
  private readonly transloco = inject(TranslocoService);
  private readonly location = inject(Location);
  private readonly server = inject(ServerPersistenceGateway);

  private _mainLoadToken = 0;
  private _shareLoadToken = 0;
  private readonly _saveInFlight = new WeakMap<Project, Promise<void>>();
  // Bindings for component editors opened **as main** (the /component/:uuid
  // route). Tab-opened editors track their own bindings in CustomComponentService;
  // these are disposed in _disposeProject when the main slot is replaced.
  private readonly _componentBindings = new WeakMap<
    Project,
    DefinitionBinding
  >();

  // -- Public API ----------------------------------------------------------

  loadProject(uuid: string): Promise<Project> {
    return this.server.loadProject(uuid);
  }

  /**
   * Persists a project to its backing store, dispatching on `source`: `'server'`
   * projects are PUT to the API, `'browser'` projects are written to IndexedDB
   * (the native file format). File is never a save target — only an export. A
   * fresh `'browser'` project with no id yet is promoted into storage here (an id
   * is generated and the URL becomes `/local/:id`). No-op for non-dirty projects
   * and for read-only shares.
   */
  async saveProject(project: Project): Promise<void> {
    const existing = this._saveInFlight.get(project);
    if (existing) return existing;

    if (!this.metadataStore.isDirty(project)) return;

    const metadata = this.metadataStore.getMetadata(project);
    if (!metadata) return;

    let work: Promise<void> | undefined;
    if (metadata.type === 'comp') {
      if (metadata.source === 'server') {
        work = this.server.saveComponent(project);
      } else if (metadata.source === 'browser') {
        work = this._doBrowserComponentSave(project);
      }
      // comp + share is read-only: nothing to save.
    } else if (metadata.source === 'server') {
      work = this.server.saveProject(project);
    } else if (metadata.source === 'browser') {
      work = this._doBrowserSave(project);
    }
    // Shares (and any unknown source) are read-only: nothing to save.
    if (!work) return;

    const promise = work.finally(() => {
      this._saveInFlight.delete(project);
    });
    this._saveInFlight.set(project, promise);
    return promise;
  }

  async createProject(
    name: string,
    description?: string,
    isPublic?: boolean
  ): Promise<string> {
    const { project, id } = await this.server.createProject(
      name,
      description,
      isPublic
    );
    this._replaceMainProject(project);
    this.location.go(`/project/${id}`);
    this.toast.success(
      this.transloco.translate('persistence.projectCreated'),
      'PersistenceService'
    );
    return id;
  }

  listProjects(
    page?: number,
    search?: string
  ): Observable<Page<ProjectSummary>> {
    return this.server.listProjects(page, search);
  }

  /** Lists circuits stored in the browser (IndexedDB), newest first. */
  listBrowserProjects(): Promise<BrowserProjectSummary[]> {
    return this.browserStore.list();
  }

  /** Removes a browser-stored circuit. */
  deleteBrowserProject(id: string): Promise<void> {
    return this.browserStore.delete(id);
  }

  /** Removes a server project via the API. */
  deleteProject(uuid: string): Observable<void> {
    return this.server.deleteProject(uuid);
  }

  /**
   * Renames a browser-stored project. The display name is duplicated out of the
   * stored content blob (the codec reads the blob's top-level `name` on open, not
   * the summary column), so both must change: the blob's `name` field is rewritten
   * and the new value re-saved as the column. If the project is currently open,
   * its in-memory metadata — and thus the title bar — is synced too.
   */
  async renameBrowserProject(id: string, name: string): Promise<void> {
    const record = await this.browserStore.get(id);
    if (!record) throw new Error(`No browser project with id ${id}`);
    await this.browserStore.save({
      id,
      name,
      content: this._withRenamedContent(record.content, name)
    });
    const handle = this.metadataStore.getHandleById(id);
    if (
      handle?.metadata.source === 'browser' &&
      handle.metadata.type === 'project'
    ) {
      this.metadataStore.update(handle.project, { name });
    }
  }

  /** Renames a server project via the API (PATCH metadata). */
  renameProject(uuid: string, name: string): Observable<void> {
    return this.server.renameProject(uuid, name);
  }

  loadShare(
    linkId: string
  ): Promise<{ project: Project; type: 'project' | 'comp' }> {
    return this.server.loadShare(linkId);
  }

  async cloneShare(linkId: string): Promise<Project> {
    const id = await this.server.cloneFromShare(linkId);
    await this.loadProjectAsMain(id);
    return this.projectService.mainProject()!;
  }

  /**
   * First save of a fresh draft to the **browser** store: applies the
   * user-chosen name, then writes to IndexedDB (which generates the id and
   * updates the URL to `/local/:id`). Bypasses the `saveProject` dirty-guard so
   * a pristine, never-edited new board can still be named and persisted.
   */
  async saveDraftAsLocal(project: Project, name: string): Promise<void> {
    this.metadataStore.update(project, { name });
    await this._doBrowserSave(project);
  }

  /**
   * First save of a fresh draft to the **server**: creates the project record
   * and PUTs the current circuit (see
   * {@link ServerPersistenceGateway.promoteToServer}), then navigates to
   * `/project/:id`. A silent primitive: it emits no toast, leaving success and
   * error reporting to the upload flow that drives it (which also handles any
   * embedded local components first).
   */
  async saveDraftAsServer(
    project: Project,
    name: string,
    isPublic: boolean
  ): Promise<void> {
    const id = await this.server.promoteToServer(project, name, isPublic);
    this.location.go(`/project/${id}`);
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
    const oldId = metadata.id;

    // The server round-trip is the only fail-able, irreversible step. Until it
    // returns, nothing local has changed and the upload can be retried.
    await this.server.promoteToServer(project, metadata.name, isPublic);
    this.location.go(`/project/${this.metadataStore.getMetadata(project)!.id}`);

    // Now cloud-backed — drop the orphaned browser record so the project moves
    // to the cloud rather than being copied.
    await this._dropBrowserProjectRecord(oldId);
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
  }

  /**
   * Creates a blank project and sets it as main. It registers as a `'browser'`
   * project with an empty id and is **not** written to storage yet — a fresh draft
   * leaves no record until the first `saveProject` of a dirty project (which
   * generates the id and updates the URL to `/local/:id`).
   */
  createAndSetEmptyProject(): Project {
    const project = new Project();
    this.metadataStore.register(project, {
      id: '',
      name: 'Untitled',
      type: 'project',
      source: 'browser',
      hash: '',
      isPublic: false
    });

    this._replaceMainProject(project);
    this.location.go('/');
    return project;
  }

  /**
   * Serializes a project to the current native file format. The name is read
   * from project metadata (the `Project` itself has no name). Returns the JSON
   * string.
   */
  exportProjectToJson(project: Project): string {
    const name = this.metadataStore.getMetadata(project)?.name ?? 'Untitled';
    return this.circuitFile.toJson(project, name);
  }

  /**
   * Exports a project as a downloadable `.json` file. Serializes to the current
   * native file format and triggers a browser download.
   */
  exportProjectToFile(project: Project): void {
    const json = this.exportProjectToJson(project);
    const metadata = this.metadataStore.getMetadata(project);
    const name = metadata?.name ?? 'Untitled';
    const blob = new Blob([json], { type: 'application/json' });
    downloadBlob(blob, `${name}.json`);
  }

  /**
   * Loads a circuit from file content into a new project, **persists it
   * immediately as a browser project** (IndexedDB), sets it as main and navigates
   * to `/local/:id`. Importing is the one path that writes a fresh draft to
   * storage up front (so a reload restores it). Throws (`InvalidFileError` /
   * `UnsupportedVersionError`) on an unreadable file — unlike server loads, there
   * is no fallback here; the caller decides how to surface it. Unsupported
   * component types are dropped silently (warning only).
   */
  async importProjectFromJson(content: string): Promise<Project> {
    const { name, components, wires } = this.circuitFile.fromJson(content);
    const project = buildProject(components, wires);
    await this._persistImportedProject(project, name);
    return project;
  }

  /**
   * Common tail of the import paths: adopts orphan custom snapshots, registers
   * metadata, writes a fresh browser draft (so a reload restores it), then sets
   * the project as main and navigates to `/local/:id`.
   */
  private async _persistImportedProject(
    project: Project,
    name: string
  ): Promise<void> {
    // Adopt any imported custom that has no local master into the browser
    // components library, so the user can re-place it. (No stable cross-file
    // identity ⇒ re-importing the same file creates duplicate library rows.)
    await this._adoptSnapshots(project);

    // addComponent/addWire don't push to the ActionManager, so the project
    // starts non-dirty even though it was just populated.
    this.metadataStore.register(project, {
      id: '',
      name,
      type: 'project',
      source: 'browser',
      hash: '',
      isPublic: false
    });

    // Re-encode through the file codec so the stored blob is always at the
    // current format version (the imported content may have been older).
    const record = await this.browserStore.save({
      name,
      content: this.circuitFile.toJson(project, name)
    });
    this.metadataStore.updateId(project, record.id);

    this._replaceMainProject(project);
    this.location.go(`/local/${record.id}`);
  }

  /**
   * Builds a debug {@link ProjectDump}: the native circuit document plus the
   * original element ids (the format drops them on load) and the serialized undo
   * history — enough to reconstruct the exact in-memory session.
   */
  buildProjectDump(project: Project): ProjectDump {
    const name = this.metadataStore.getMetadata(project)?.name ?? 'Untitled';
    const actionManager = project.actionManager;
    return {
      dumpVersion: PROJECT_DUMP_VERSION,
      name,
      project: JSON.parse(this.circuitFile.toJson(project, name)),
      componentIds: [...project.components].map((c) => c.id),
      wireIds: [...project.wires].map((w) => w.id),
      actions: {
        history: actionManager.history.map((a) => a.serialize()),
        pointer: actionManager.pointer
      }
    };
  }

  /** Exports a {@link ProjectDump} as a downloadable `.dump.json` file. */
  exportProjectDumpToFile(project: Project): void {
    const dump = this.buildProjectDump(project);
    const blob = new Blob([JSON.stringify(dump)], {
      type: 'application/json'
    });
    downloadBlob(blob, `${dump.name}.dump.json`);
  }

  /**
   * Imports a debug {@link ProjectDump}: loads the circuit body exactly like a
   * file import, re-stamps the saved element ids onto the freshly-built
   * instances, then restores the undo history so undo/redo walks the real
   * session. If the loaded element count no longer matches the id lists (e.g. a
   * custom dropped because its definition is missing), id and history restoration
   * are skipped with a warning — the circuit still loads.
   */
  async importProjectDump(content: string): Promise<Project> {
    const dump = JSON.parse(content) as ProjectDump;
    if (!dump || typeof dump !== 'object' || dump.project === undefined) {
      throw new Error('Not a Project Dump file');
    }

    const { name, components, wires } = this.circuitFile.decode(dump.project);

    const idsMatch =
      components.length === dump.componentIds?.length &&
      wires.length === dump.wireIds?.length;
    if (idsMatch) {
      components.forEach((c, i) => (c.id = dump.componentIds[i]));
      wires.forEach((w, i) => (w.id = dump.wireIds[i]));
    } else {
      this.toast.warn(
        this.transloco.translate('persistence.dumpElementCountChanged'),
        'PersistenceService'
      );
    }

    const project = buildProject(components, wires);
    await this._persistImportedProject(project, name);

    if (idsMatch && dump.actions) {
      project.actionManager.restore(
        dump.actions.history.map(deserializeAction),
        dump.actions.pointer
      );
    }
    return project;
  }

  async loadProjectAsMain(
    uuid: string,
    opts?: { skipUrlUpdate?: boolean }
  ): Promise<void> {
    const token = ++this._mainLoadToken;
    try {
      const project = await this.loadProject(uuid);
      if (token !== this._mainLoadToken) {
        this._disposeProject(project);
        return;
      }
      this._replaceMainProject(project);
      this.logging.info(
        `Loaded project ${uuid} (server)`,
        'PersistenceService'
      );
      if (!opts?.skipUrlUpdate) {
        this.location.go(`/project/${uuid}`);
      }
    } catch (e) {
      if (token === this._mainLoadToken) {
        this.toast.error(
          this.transloco.translate('persistence.loadFailed'),
          'PersistenceService',
          `Failed to load project ${uuid}: ${formatHttpError(e)}`
        );
        if (!this.projectService.mainProject()) {
          this.createAndSetEmptyProject();
        }
      }
    }
  }

  async loadShareAsMain(linkId: string): Promise<void> {
    const token = ++this._shareLoadToken;
    try {
      const { project, type } = await this.loadShare(linkId);
      if (token !== this._shareLoadToken) {
        this._disposeProject(project);
        return;
      }
      if (type === 'comp') {
        this.projectService.addOpenComponent(project);
      } else {
        this._replaceMainProject(project);
      }
      this.logging.info(
        `Loaded share ${linkId} (${type})`,
        'PersistenceService'
      );
    } catch (e) {
      if (token === this._shareLoadToken) {
        this.toast.error(
          this.transloco.translate('persistence.shareLoadFailed'),
          'PersistenceService',
          `Failed to load share ${linkId}: ${formatHttpError(e)}`
        );
        if (!this.projectService.mainProject()) {
          this.createAndSetEmptyProject();
        }
      }
    }
  }

  /**
   * Loads a browser-stored circuit (IndexedDB) into a new project and registers
   * it as a `'browser'` project. Mirrors `loadProject` for the server target.
   * Rejects if no record exists for `id`.
   */
  async loadLocalProject(id: string): Promise<Project> {
    const record = await this.browserStore.get(id);
    if (!record) {
      throw new Error(`No browser project with id ${id}`);
    }
    const { name, components, wires } = this.circuitFile.fromJson(
      record.content
    );
    const project = buildProject(components, wires);

    this.metadataStore.register(project, {
      id: record.id,
      name,
      type: 'project',
      source: 'browser',
      hash: '',
      isPublic: false
    });

    return project;
  }

  /** Lists library masters stored in the browser (IndexedDB), newest first. */
  listBrowserComponents(): Promise<BrowserComponentSummary[]> {
    return this.browserComponentStore.list();
  }

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
              circuit
            },
            'browser'
          );
        } catch {
          this.logging.warn(
            `Failed to preload browser component ${id}`,
            'PersistenceService'
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
  async preloadComponentIdAliases(): Promise<void> {
    try {
      const mappings = await this.componentIdMapStore.list();
      for (const { id, newId } of mappings) {
        this.registry.registerIdAlias(id, newId);
      }
    } catch {
      this.logging.warn(
        'Failed to load component id aliases',
        'PersistenceService'
      );
    }
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
      hash: newHash
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
    // whose id has been promoted (see preloadBrowserMasters / isPromotedId).
    try {
      await this.componentIdMapStore.put(oldId, newId);
      await this.browserComponentStore.delete(oldId);
    } catch {
      this.logging.warn(
        `Component ${oldId} uploaded to the cloud, but local cleanup failed`,
        'PersistenceService'
      );
    }

    this.registry.promoteMaster(masterTypeId, newId, version);
    this.logging.info(
      `Promoted component ${oldId} -> ${newId} (v${version})`,
      'PersistenceService'
    );
    // If the master's own editor tab is open, flip its metadata to the new server
    // identity so a later save routes to the cloud instead of re-creating the
    // browser record that was just deleted.
    this._reconcilePromotedEditor(oldId, newId, newHash);
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
   * Loads a browser-stored **library master** into a fresh editor Project and
   * registers it (reusing the master's session type id if it is already known, so
   * placing it from the palette and opening it share one definition). Returns the
   * Project plus the master type id so the caller can attach a `DefinitionBinding`
   * and open a tab. The circuit is self-contained — its embedded snapshots are
   * ingested with no cross-row resolution. Rejects if no record exists for `id`.
   */
  async loadComponentForEdit(
    id: string
  ): Promise<{ project: Project; masterTypeId: number }> {
    const record = await this.browserComponentStore.get(id);
    if (!record) {
      throw new Error(`No browser component with id ${id}`);
    }
    const { components, wires } = this.circuitFile.fromJson(record.content);
    const project = buildProject(components, wires);

    const masterTypeId =
      this.registry.masterTypeIdForId(id) ??
      this.registry.createMaster(
        {
          id,
          version: record.version,
          name: record.name,
          symbol: record.symbol,
          description: record.description,
          numInputs: record.numInputs,
          numOutputs: record.numOutputs,
          labels: record.labels
        },
        'browser'
      );

    this.metadataStore.register(project, {
      id,
      name: record.name,
      type: 'comp',
      source: 'browser',
      hash: '',
      isPublic: false
    });

    return { project, masterTypeId };
  }

  /**
   * Creates a new **server** library master: POSTs to `/api/component`, registers
   * the master, opens an empty editor Project and persists the initial empty
   * circuit to establish a hash. Returns the Project + master type id so the
   * caller (`CustomComponentService`) opens the tab and attaches a binding.
   */
  createServerComponent(meta: {
    name: string;
    symbol: string;
    description: string;
    isPublic?: boolean;
  }): Promise<{ project: Project; masterTypeId: number }> {
    return this.server.createComponent(meta);
  }

  /**
   * Loads a **server** library master into a fresh editor Project. Returns the
   * Project + master type id for the caller to open a tab / set as main and
   * attach a binding.
   */
  loadServerComponent(
    uuid: string
  ): Promise<{ project: Project; masterTypeId: number }> {
    return this.server.loadComponent(uuid);
  }

  /**
   * Loads a server component **as the main project** for standalone editing
   * (the `/component/:uuid` route, mirroring `loadProjectAsMain`). Attaches a
   * `DefinitionBinding` so its summary stays current; the binding is disposed
   * when the main slot is later replaced (`_disposeProject`).
   */
  async loadComponentAsMain(
    uuid: string,
    opts?: { skipUrlUpdate?: boolean }
  ): Promise<void> {
    const token = ++this._mainLoadToken;
    try {
      const { project, masterTypeId } = await this.loadServerComponent(uuid);
      if (token !== this._mainLoadToken) {
        this._disposeProject(project);
        return;
      }
      this._replaceMainProject(project);
      this._componentBindings.set(
        project,
        new DefinitionBinding(project, masterTypeId, this.registry)
      );
      this.logging.info(
        `Loaded component ${uuid} (server)`,
        'PersistenceService'
      );
      if (!opts?.skipUrlUpdate) {
        this.location.go(`/component/${uuid}`);
      }
    } catch (e) {
      if (token === this._mainLoadToken) {
        this.toast.error(
          this.transloco.translate('persistence.componentLoadFailed'),
          'PersistenceService',
          `Failed to load component ${uuid}: ${formatHttpError(e)}`
        );
        if (!this.projectService.mainProject()) {
          this.createAndSetEmptyProject();
        }
      }
    }
  }

  async loadLocalProjectAsMain(
    id: string,
    opts?: { skipUrlUpdate?: boolean }
  ): Promise<void> {
    // Server and browser projects share the single main slot, so they share the
    // load token: starting either load discards a still-pending one of the other.
    const token = ++this._mainLoadToken;
    try {
      const project = await this.loadLocalProject(id);
      if (token !== this._mainLoadToken) {
        this._disposeProject(project);
        return;
      }
      this._replaceMainProject(project);
      this.logging.info(`Loaded project ${id} (browser)`, 'PersistenceService');
      if (!opts?.skipUrlUpdate) {
        this.location.go(`/local/${id}`);
      }
    } catch (e) {
      if (token === this._mainLoadToken) {
        this.toast.error(
          this.transloco.translate('persistence.loadFailed'),
          'PersistenceService',
          `Failed to load browser project ${id}: ${formatHttpError(e)}`
        );
        if (!this.projectService.mainProject()) {
          this.createAndSetEmptyProject();
        }
      }
    }
  }

  // -- Private helpers -----------------------------------------------------

  /**
   * Builds a throwaway project from stored circuit JSON, runs `fn` on it (a
   * serialize-and-upload step), and always tears the project down. Shared by
   * the upload paths that push a stored record without opening it.
   */
  private async _withProjectFromContent<T>(
    content: string,
    fn: (project: Project) => Promise<T>
  ): Promise<T> {
    const { components, wires } = this.circuitFile.fromJson(content);
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
        'PersistenceService'
      );
    }
  }

  /**
   * Creates a browser library master for every custom directly placed in an
   * imported project that has no local master yet, so it appears in the palette
   * and survives a reload. Already-known masters (matched by provenance id) are
   * left alone. Nested-only customs are not adopted — they live inside their
   * parent's snapshot and aren't independently placeable here.
   */
  private async _adoptSnapshots(project: Project): Promise<void> {
    const seen = new Set<number>();
    for (const component of project.components) {
      const typeId = component.config.type;
      if (seen.has(typeId)) continue;
      seen.add(typeId);
      const def = this.registry.getDefinition(typeId);
      if (!def || def.kind !== 'snapshot') continue;
      if (
        def.id !== undefined &&
        this.registry.masterTypeIdForId(def.id) !== undefined
      ) {
        continue;
      }
      await this._adoptSnapshotAsMaster(def);
    }
  }

  /**
   * Builds a browser-library master from a snapshot definition's frozen circuit
   * (its own nested snapshots re-emitted as self-contained content) and registers
   * it, returning the new master's id. By default the store mints a fresh id at
   * version 1; `options` can reuse a specific id (so placed instances re-link
   * with no extra work) and adopt the snapshot's frozen version.
   */
  private async _adoptSnapshotAsMaster(
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
    this.registry.createMaster({ id: record.id, ...summary, circuit }, 'browser');
    return record.id;
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
    const newId = await this._adoptSnapshotAsMaster(def, {
      id: reuseId,
      version: def.version ?? 1
    });
    // A fresh id was minted (anonymous or cloud-origin snapshot): re-point it
    // (and thus its instances) at the new master.
    if (def.id !== newId) {
      this.registry.relinkSnapshotProvenance(typeId, newId);
    }
    this.logging.info(
      `Restored orphan component ${def.name} -> ${newId}`,
      'PersistenceService'
    );
    return newId;
  }

  /**
   * Returns the stored circuit JSON with its top-level `name` replaced. Browser
   * blobs are always current-version with a top-level `name` (every write path
   * goes through `CircuitFileService.toJson`), so a structural rewrite suffices —
   * decoding to instances would needlessly ingest the project's custom snapshots
   * into the live registry as a side effect of a background rename.
   */
  private _withRenamedContent(content: string, name: string): string {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content) as Record<string, unknown>;
    } catch {
      throw new Error('Stored project content is not valid JSON');
    }
    return JSON.stringify({ ...parsed, name });
  }

  private async _doBrowserSave(project: Project): Promise<void> {
    // Same dirty-version snapshot guard as the server save: the IndexedDB write
    // awaits, so an edit can land mid-save and must keep the project dirty.
    const metadata = this.metadataStore.getMetadata(project)!;
    const versionAtSnapshot = this.metadataStore.dirtyVersion(project);
    const content = this.circuitFile.toJson(project, metadata.name);

    const record = await this.browserStore.save({
      id: metadata.id || undefined,
      name: metadata.name,
      content
    });

    // First save of a fresh draft: record the generated id and reflect it in
    // the URL so a reload restores this project via the /local/:id route.
    if (metadata.id !== record.id) {
      this.metadataStore.updateId(project, record.id);
      this.location.go(`/local/${record.id}`);
    }

    if (this.metadataStore.dirtyVersion(project) === versionAtSnapshot) {
      this.metadataStore.clearDirty(project);
    }
    this.toast.success(
      this.transloco.translate('persistence.projectSavedBrowser'),
      'PersistenceService'
    );
  }

  /**
   * Saves a custom-component editor (`type: 'comp'`) to the browser `components`
   * store: its summary columns (recomputed from its plugs at save time) plus its
   * `content` (own circuit + embedded snapshots of its dependencies). Does not
   * retroactively change placed instances — they are frozen snapshots; this only
   * affects future placements and explicit per-instance updates.
   */
  private async _doBrowserComponentSave(project: Project): Promise<void> {
    const metadata = this.metadataStore.getMetadata(project)!;
    const masterTypeId = this.registry.masterTypeIdForId(metadata.id);
    const master =
      masterTypeId !== undefined
        ? this.registry.getDefinition(masterTypeId)
        : undefined;
    const versionAtSnapshot = this.metadataStore.dirtyVersion(project);
    const summary = deriveSummary(project);
    const content = this.circuitFile.toJson(project, metadata.name);

    // Auto-increment the monotonic version so that placed instances frozen at an
    // older version can detect "a newer master exists" and offer the update button.
    const newVersion = (master?.version ?? 0) + 1;

    await this.browserComponentStore.save({
      id: metadata.id || undefined,
      version: newVersion,
      name: metadata.name,
      symbol: master?.symbol ?? '',
      description: master?.description ?? '',
      numInputs: summary.numInputs,
      numOutputs: summary.numOutputs,
      labels: summary.labels,
      content
    });

    // Adopt the bumped version so the in-memory master reflects it, invalidates
    // the placement snapshot cache, and placed instances behind this version can
    // detect "a newer master exists".
    if (masterTypeId !== undefined) {
      this.registry.setMasterVersion(masterTypeId, newVersion);
    }

    if (this.metadataStore.dirtyVersion(project) === versionAtSnapshot) {
      this.metadataStore.clearDirty(project);
    }
    this.toast.success(
      this.transloco.translate('persistence.componentSavedBrowser'),
      'PersistenceService'
    );
  }

  private _replaceMainProject(newProject: Project): void {
    const previous = this.projectService.mainProject();
    this.projectService.setMainProject(newProject);
    if (previous && previous !== newProject) {
      this._disposeProject(previous);
    }
  }

  private _disposeProject(project: Project): void {
    this._componentBindings.get(project)?.dispose();
    this._componentBindings.delete(project);
    this.metadataStore.remove(project);
    project.destroy();
  }
}
