import { inject, Injectable } from '@angular/core';
import { Location } from '@angular/common';
import { Observable } from 'rxjs';
import { CircuitFileService } from './file/circuit-file.service';
import { BrowserProjectStore } from './browser/browser-project.store';
import { BrowserComponentStore } from './browser/browser-component.store';
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
import { formatHttpError } from './persistence-errors';
import { ServerPersistenceGateway } from './server/server-persistence.gateway';

export { AuthRequiredError } from './persistence-errors';

@Injectable({ providedIn: 'root' })
export class PersistenceService {
  private readonly circuitFile = inject(CircuitFileService);
  private readonly browserStore = inject(BrowserProjectStore);
  private readonly browserComponentStore = inject(BrowserComponentStore);
  private readonly registry = inject(CustomComponentRegistry);
  private readonly provider = inject(ComponentProviderService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly projectService = inject(ProjectService);
  private readonly toast = inject(ToastService);
  private readonly logging = inject(LoggingService);
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
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}.json`;
    link.click();
    URL.revokeObjectURL(url);
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
      if (!opts?.skipUrlUpdate) {
        this.location.go(`/project/${uuid}`);
      }
    } catch (e) {
      if (token === this._mainLoadToken) {
        this.logging.error(
          `Failed to load project ${uuid}: ${formatHttpError(e)}`,
          'PersistenceService'
        );
        this.toast.error(
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
    } catch (e) {
      if (token === this._shareLoadToken) {
        this.logging.error(
          `Failed to load share ${linkId}: ${formatHttpError(e)}`,
          'PersistenceService'
        );
        this.toast.error(
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
      if (!opts?.skipUrlUpdate) {
        this.location.go(`/component/${uuid}`);
      }
    } catch (e) {
      if (token === this._mainLoadToken) {
        this.logging.error(
          `Failed to load component ${uuid}: ${formatHttpError(e)}`,
          'PersistenceService'
        );
        this.toast.error(
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
      if (!opts?.skipUrlUpdate) {
        this.location.go(`/local/${id}`);
      }
    } catch (e) {
      if (token === this._mainLoadToken) {
        this.logging.error(
          `Failed to load browser project ${id}: ${formatHttpError(e)}`,
          'PersistenceService'
        );
        this.toast.error(
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

  private async _adoptSnapshotAsMaster(
    def: CustomComponentDefinition
  ): Promise<void> {
    const circuit = def.circuit ?? { components: [], wires: [] };
    // Re-emit the snapshot's circuit (+ its own nested snapshots) as the new
    // master's self-contained content.
    const { components, wires } = instantiateBody(this.provider, circuit);
    const tmp = buildProject(components, wires);
    let content: string;
    try {
      content = this.circuitFile.toJson(tmp, def.name);
    } finally {
      tmp.destroy();
    }

    const record = await this.browserComponentStore.save({
      version: 1,
      name: def.name,
      symbol: def.symbol,
      description: def.description,
      numInputs: def.numInputs,
      numOutputs: def.numOutputs,
      labels: def.labels,
      content
    });
    this.registry.createMaster(
      {
        id: record.id,
        version: 1,
        name: def.name,
        symbol: def.symbol,
        description: def.description,
        numInputs: def.numInputs,
        numOutputs: def.numOutputs,
        labels: def.labels,
        circuit
      },
      'browser'
    );
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
    this.toast.success('Project saved to browser storage');
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

    await this.browserComponentStore.save({
      id: metadata.id || undefined,
      version: master?.version ?? 1,
      name: metadata.name,
      symbol: master?.symbol ?? '',
      description: master?.description ?? '',
      numInputs: summary.numInputs,
      numOutputs: summary.numOutputs,
      labels: summary.labels,
      content
    });

    if (this.metadataStore.dirtyVersion(project) === versionAtSnapshot) {
      this.metadataStore.clearDirty(project);
    }
    this.toast.success('Component saved to browser storage');
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
