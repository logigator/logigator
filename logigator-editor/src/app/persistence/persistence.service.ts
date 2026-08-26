import { inject, Injectable } from '@angular/core';
import { Location } from '@angular/common';
import { firstValueFrom, Observable } from 'rxjs';
import { TranslationService } from '../translation/translation.service';
import { TranslationKey } from '../translation/translation-key.model';
import { CircuitFileService } from './file/circuit-file.service';
import { BrowserProjectStore } from './browser/browser-project.store';
import {
  BrowserComponentSummary,
  BrowserProjectSummary
} from './browser/browser-project.types';
import { ProjectMetadataStore } from './project-metadata.store';
import { ProjectService } from '../project/project.service';
import { ToastService } from '../logging/toast.service';
import { LoggingService } from '../logging/logging.service';
import { Project } from '../project/project';
import { ForkAttributionEntry, ProjectSummary } from '../api/models/project';
import { Page } from '../api/models/shared';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { DefinitionBinding } from '../custom-component/definition-binding';
import { buildProject } from './circuit-builder';
import {
  AuthRequiredError,
  ForeignDocumentError,
  formatHttpError
} from './persistence-errors';
import { CloudSessionService } from '../user/cloud-session.service';
import { ServerPersistenceGateway } from './server/server-persistence.gateway';
import { BrowserPersistenceGateway } from './browser/browser-persistence.gateway';
import { downloadBlob } from '../utils/download';
import { warnSkippedCustoms } from './load-warnings';
import { decodeLgix, encodeLgix, hasLgixMagic } from '@logigator/core';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEvent } from '../analytics/analytics.mapping';
import { WireRepairService } from '../project/wire-repair.service';

@Injectable({ providedIn: 'root' })
export class PersistenceService {
  private readonly circuitFile = inject(CircuitFileService);
  private readonly browserStore = inject(BrowserProjectStore);
  private readonly registry = inject(CustomComponentRegistry);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly projectService = inject(ProjectService);
  private readonly toast = inject(ToastService);
  private readonly logging = inject(LoggingService);
  private readonly translation = inject(TranslationService);
  private readonly location = inject(Location);
  private readonly server = inject(ServerPersistenceGateway);
  private readonly analytics = inject(AnalyticsService);
  private readonly browser = inject(BrowserPersistenceGateway);
  private readonly cloudSession = inject(CloudSessionService);
  private readonly wireRepair = inject(WireRepairService);

  private _mainLoadToken = 0;
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

    if (metadata.source === 'server') {
      this._assertCloudSavable(project, metadata.name);
    }

    let work: Promise<void> | undefined;
    if (metadata.type === 'comp') {
      if (metadata.source === 'server') {
        work = this.server.saveComponent(project);
      } else if (metadata.source === 'browser') {
        work = this.browser.saveComponent(project);
      }
      // comp + share is read-only: nothing to save.
    } else if (metadata.source === 'server') {
      work = this.server.saveProject(project);
    } else if (metadata.source === 'browser') {
      work = this.browser.saveProject(project);
    }
    // Shares (and any unknown source) are read-only: nothing to save.
    if (!work) return;

    const promise = work
      .then(() => {
        this.analytics.capture(AnalyticsEvent.ProjectSaved, {
          source: metadata.source,
          type: metadata.type
        });
      })
      .finally(() => {
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
    this._requireSignedIn();
    const { project, id } = await this.server.createProject(
      name,
      description,
      isPublic
    );
    this._replaceMainProject(project);
    this.location.go(`/project/${id}`);
    this.toast.success(
      this.translation.translate('persistence.projectCreated'),
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
    return this.browser.listProjects();
  }

  /** Removes a browser-stored circuit. */
  deleteBrowserProject(id: string): Promise<void> {
    return this.browser.deleteProject(id);
  }

  /** Removes a server project via the API. */
  deleteProject(uuid: string): Observable<void> {
    return this.server.deleteProject(uuid);
  }

  /**
   * Renames a browser-stored project from the Open Project dialog (both the
   * stored blob's top-level `name` and the summary column; an open project's
   * in-memory metadata is synced too).
   */
  renameBrowserProject(id: string, name: string): Promise<void> {
    return this.browser.renameProject(id, name);
  }

  /** Renames a server project via the API (PATCH metadata). */
  renameProject(uuid: string, name: string): Observable<void> {
    return this.server.renameProject(uuid, name);
  }

  /**
   * Renames the currently-open project (e.g. from the title bar's inline
   * editor), dispatching by source so the name persists where it lives: server
   * projects PATCH their metadata, browser projects rewrite their stored blob,
   * and a never-saved draft (browser, no id) updates its in-memory metadata only
   * — the name is picked up at its first save. All three sync the live metadata,
   * so the title bar reflects the change reactively. Scoped to `type:'project'`;
   * component editors are not renamable inline. Shares are read-only.
   */
  async renameOpenProject(project: Project, name: string): Promise<void> {
    const metadata = this.metadataStore.getMetadata(project);
    if (!metadata || metadata.type !== 'project' || metadata.source === 'share')
      return;

    if (metadata.source === 'server') {
      await firstValueFrom(this.renameProject(metadata.id, name));
    } else if (metadata.id !== '') {
      await this.renameBrowserProject(metadata.id, name);
    } else {
      this.metadataStore.update(project, { name });
    }
  }

  loadShare(
    linkId: string
  ): Promise<{ project: Project; type: 'project' | 'comp' }> {
    return this.server.loadShare(linkId);
  }

  /**
   * Copies a share into the viewer's own cloud library and opens the copy as
   * main. `type` selects both the clone endpoint and the load path, so a cloned
   * component lands in the components library and reopens through
   * {@link loadComponentAsMain} (which attaches its `DefinitionBinding`), not as
   * a project.
   */
  async cloneShare(linkId: string, type: 'project' | 'comp'): Promise<Project> {
    const id = await this.server.cloneFromShare(linkId, type);
    if (type === 'comp') {
      await this.loadComponentAsMain(id);
    } else {
      await this.loadProjectAsMain(id);
    }
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
    await this.browser.saveProject(project);
    // First local save routes through the gateway directly, not saveProject.
    this.analytics.capture(AnalyticsEvent.ProjectSaved, {
      source: 'browser',
      type: this.metadataStore.getMetadata(project)?.type ?? 'project'
    });
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
   * Serializes a project to the current native file format. The name and fork
   * attribution are read from project metadata (the `Project` itself has
   * neither), so an exported fork keeps naming its original creators.
   */
  exportProjectToJson(project: Project): string {
    const metadata = this.metadataStore.getMetadata(project);
    return this.circuitFile.toJson(
      project,
      metadata?.name ?? 'Untitled',
      metadata?.attribution
    );
  }

  /**
   * Serializes a project to the current native file format and triggers a
   * browser download of a compressed `.lgix` file (gzipped JSON in a magic-byte
   * container — see {@link encodeLgix}).
   *
   * Refuses a borrowed `source:'share'` document: a share is read-only, and
   * exporting one to a file would let it be re-imported as the user's own. The
   * menu hides the action for shares; this guard is the defense-in-depth behind
   * it (the format carries no enforceable ownership).
   */
  async exportProjectToFile(project: Project): Promise<void> {
    const metadata = this.metadataStore.getMetadata(project);
    if (metadata?.source === 'share') {
      throw new Error('Shares cannot be exported to a file');
    }
    const json = this.exportProjectToJson(project);
    const name = metadata?.name ?? 'Untitled';
    const bytes = await encodeLgix(json);
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    downloadBlob(blob, `${name}.lgix`);
    this.analytics.capture(AnalyticsEvent.ProjectExported, { format: 'lgix' });
  }

  /**
   * Serializes a project to the current native file format and triggers a
   * browser download of the **uncompressed** JSON document — the same content
   * {@link exportProjectToFile} gzips into a `.lgix`, saved as a plain `.json`
   * for inspection. A debug-only convenience; the shipped export path is
   * `.lgix`.
   */
  exportProjectToJsonFile(project: Project): void {
    const name = this.metadataStore.getMetadata(project)?.name ?? 'Untitled';
    const json = this.exportProjectToJson(project);
    const blob = new Blob([json], { type: 'application/json' });
    downloadBlob(blob, `${name}.json`);
  }

  /**
   * Imports a circuit from a picked file's raw bytes, transparently handling
   * both the compressed `.lgix` container and a plain-text `.json` document (the
   * permanently-supported legacy `logigator-editor` export). Branches on the
   * `.lgix` magic; anything else is decoded as UTF-8 JSON. Delegates to
   * {@link importProjectFromJson} once unwrapped.
   */
  async importProjectFromFile(data: ArrayBuffer): Promise<Project> {
    const bytes = new Uint8Array(data);
    const isLgix = hasLgixMagic(bytes);
    const json = isLgix
      ? await decodeLgix(bytes)
      : new TextDecoder().decode(bytes);
    const project = await this.importProjectFromJson(json);
    this.analytics.capture(AnalyticsEvent.ProjectImported, {
      format: isLgix ? 'lgix' : 'json'
    });
    return project;
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
    const { name, attribution, components, wires, skippedCustom } =
      this.circuitFile.fromJson(content);
    warnSkippedCustoms(
      this.toast,
      this.translation,
      skippedCustom,
      'PersistenceService'
    );
    const project = buildProject(components, wires);
    await this.persistImportedProject(project, name, attribution);
    return project;
  }

  /**
   * Common tail of the import paths (file import here, dump import in
   * `ProjectDumpService`): registers metadata, writes a fresh browser draft
   * (so a reload restores it), then sets the project as main and navigates to
   * `/local/:id`.
   *
   * Imported customs are never adopted into the library: each resolves through
   * its provenance id to a local or cloud master when one exists, and stays an
   * embedded (restorable) snapshot otherwise.
   *
   * The file's fork attribution (if any) is carried into the metadata and the
   * stored blob, so a later upload still credits the original creators.
   */
  async persistImportedProject(
    project: Project,
    name: string,
    attribution?: ForkAttributionEntry[]
  ): Promise<void> {
    // addComponent/addWire don't push to the ActionManager, so the project
    // starts non-dirty even though it was just populated.
    this.metadataStore.register(project, {
      id: '',
      name,
      type: 'project',
      source: 'browser',
      hash: '',
      isPublic: false,
      attribution
    });

    // Re-encode through the file codec so the stored blob is always at the
    // current format version (the imported content may have been older).
    const record = await this.browserStore.save({
      name,
      content: this.circuitFile.toJson(project, name, attribution)
    });
    this.metadataStore.updateId(project, record.id);

    this._replaceMainProject(project);
    this.location.go(`/local/${record.id}`);
    this.wireRepair.offerRepairOnLoad(project);
  }

  /**
   * Shared skeleton of the load-as-main entry points: allocates a race token,
   * runs `load`, and — only when this load is still the current one — hands the
   * result to `onLoaded` (which places the project, logs, and updates the URL).
   * A stale result is disposed; a failure toasts `failureMessageKey` and falls
   * back to a blank draft when no main project exists at all.
   */
  private async _loadAsMain<T>(opts: {
    /** Where the loaded document came from, for analytics. */
    source: 'server' | 'browser' | 'component' | 'share';
    load: () => Promise<T>;
    projectOf: (result: T) => Project;
    onLoaded: (result: T) => void;
    failureMessageKey: TranslationKey;
    failureDetail: string;
  }): Promise<void> {
    // One race token for every entry point: they all fill the single main slot,
    // so starting any of them discards a still-pending load of the others.
    const token = ++this._mainLoadToken;
    const isCurrent = (): boolean => token === this._mainLoadToken;
    try {
      const result = await opts.load();
      if (!isCurrent()) {
        this._disposeProject(opts.projectOf(result));
        return;
      }
      opts.onLoaded(result);
      // After onLoaded: the offer reads the document's metadata, which is
      // registered as the project is placed.
      this.wireRepair.offerRepairOnLoad(opts.projectOf(result));
      this.analytics.capture(AnalyticsEvent.ProjectLoaded, {
        source: opts.source
      });
    } catch (e) {
      if (isCurrent()) {
        this.toast.error(
          this.translation.translate(opts.failureMessageKey),
          'PersistenceService',
          `${opts.failureDetail}: ${formatHttpError(e)}`
        );
        if (!this.projectService.mainProject()) {
          this.createAndSetEmptyProject();
        }
      }
    }
  }

  async loadProjectAsMain(
    uuid: string,
    opts?: { skipUrlUpdate?: boolean }
  ): Promise<void> {
    await this._loadAsMain({
      source: 'server',
      load: () => this.loadProject(uuid),
      projectOf: (project) => project,
      onLoaded: (project) => {
        this._replaceMainProject(project);
        this.logging.info(
          `Loaded project ${uuid} (server)`,
          'PersistenceService'
        );
        if (!opts?.skipUrlUpdate) {
          this.location.go(`/project/${uuid}`);
        }
      },
      failureMessageKey: 'persistence.loadFailed',
      failureDetail: `Failed to load project ${uuid}`
    });
  }

  /**
   * Loads a share link into the main slot. Both kinds fill it: a component
   * share opens standalone exactly as `/component/:uuid` does, so the title
   * bar names it, its tab is the pinned one, and the clone affordance reads the
   * document the viewer is actually looking at. Opening one as a *tab* instead
   * would leave the main slot empty on a `/share/:linkId` page load (the route
   * matched, so no blank draft was created), and closing that tab would leave
   * no project at all.
   */
  async loadShareAsMain(linkId: string): Promise<void> {
    await this._loadAsMain({
      source: 'share',
      load: () => this.loadShare(linkId),
      projectOf: ({ project }) => project,
      onLoaded: ({ project, type }) => {
        this._replaceMainProject(project);
        this.logging.info(
          `Loaded share ${linkId} (${type})`,
          'PersistenceService'
        );
      },
      failureMessageKey: 'persistence.shareLoadFailed',
      failureDetail: `Failed to load share ${linkId}`
    });
  }

  /**
   * Loads a browser-stored circuit (IndexedDB) into a new project and registers
   * it as a `'browser'` project. Mirrors `loadProject` for the server target.
   * Rejects if no record exists for `id`.
   */
  loadLocalProject(id: string): Promise<Project> {
    return this.browser.loadProject(id);
  }

  /** Lists library masters stored in the browser (IndexedDB), newest first. */
  listBrowserComponents(): Promise<BrowserComponentSummary[]> {
    return this.browser.listComponents();
  }

  /**
   * Loads a browser-stored **library master** into a fresh editor Project for
   * a tab, returning the Project + master type id so the caller can attach a
   * `DefinitionBinding`. See {@link BrowserPersistenceGateway.loadComponentForEdit}.
   */
  loadComponentForEdit(
    id: string
  ): Promise<{ project: Project; masterTypeId: number }> {
    return this.browser.loadComponentForEdit(id);
  }

  /**
   * Creates a new **server** library master: POSTs to `/api/component`, registers
   * the master, opens an empty editor Project and persists the initial empty
   * circuit to establish a hash. Returns the Project + master type id so the
   * caller (`CustomComponentService`) opens the tab and attaches a binding.
   */
  async createServerComponent(meta: {
    name: string;
    symbol: string;
    description: string;
    isPublic?: boolean;
  }): Promise<{ project: Project; masterTypeId: number }> {
    this._requireSignedIn();
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
   * Loads a server master **for editing**, reusing the session-wide circuit
   * cache so a component fetched for placement (or a previous edit) is not
   * re-fetched. Falls back to a full load for a master that is not yet
   * registered. See {@link ServerPersistenceGateway.loadComponentForEdit}.
   */
  loadServerComponentForEdit(
    uuid: string
  ): Promise<{ project: Project; masterTypeId: number }> {
    return this.server.loadComponentForEdit(uuid);
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
    await this._loadAsMain({
      source: 'component',
      load: () => this.loadServerComponent(uuid),
      projectOf: ({ project }) => project,
      onLoaded: ({ project, masterTypeId }) => {
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
      },
      failureMessageKey: 'persistence.componentLoadFailed',
      failureDetail: `Failed to load component ${uuid}`
    });
  }

  async loadLocalProjectAsMain(
    id: string,
    opts?: { skipUrlUpdate?: boolean }
  ): Promise<void> {
    await this._loadAsMain({
      source: 'browser',
      load: () => this.loadLocalProject(id),
      projectOf: (project) => project,
      onLoaded: (project) => {
        this._replaceMainProject(project);
        this.logging.info(
          `Loaded project ${id} (browser)`,
          'PersistenceService'
        );
        if (!opts?.skipUrlUpdate) {
          this.location.go(`/local/${id}`);
        }
      },
      failureMessageKey: 'persistence.loadFailed',
      failureDetail: `Failed to load browser project ${id}`
    });
  }

  // -- Private helpers -----------------------------------------------------

  /**
   * Rejects a cloud save that cannot land in the right account: signed out
   * (external logout / expired session) or a document loaded under a different
   * user than the one now signed in. Toasts the specific reason here — the
   * single choke point — and throws a marker error the outer save flows
   * recognize as already surfaced (see {@link isHandledSaveError}).
   */
  private _assertCloudSavable(project: Project, name: string): void {
    const verdict = this.cloudSession.verdict(project);
    if (verdict === 'ok') return;
    if (verdict === 'logged-out') {
      this.toast.error(
        this.translation.translate('session.saveLoggedOut'),
        'PersistenceService'
      );
      throw new AuthRequiredError();
    }
    this.toast.error(
      this.translation.translate('session.saveForeign', { name }),
      'PersistenceService'
    );
    throw new ForeignDocumentError();
  }

  /**
   * Rejects creating a *new* cloud record (create / promote / upload) while
   * signed out — the proactive counterpart to the 401 the API would return.
   * Toasts once and throws the same marker error as {@link _assertCloudSavable}.
   */
  private _requireSignedIn(): void {
    if (this.cloudSession.isSignedIn()) return;
    this.toast.error(
      this.translation.translate('session.saveLoggedOut'),
      'PersistenceService'
    );
    throw new AuthRequiredError();
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
