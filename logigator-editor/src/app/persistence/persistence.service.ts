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
import {
  isApiError,
  type DocumentVisibility,
  type ProjectPage
} from '@logigator/contract';
import type { LgDocumentKind } from '@logigator/ui';
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
import {
  decodeLgix,
  encodeLgix,
  hasLgixMagic,
  type FileForkAttributionV1
} from '@logigator/core';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEvent } from '../analytics/analytics.mapping';
import { WireRepairService } from '../project/wire-repair.service';

/**
 * What a load-as-main attempt did. The failure travels with the flag rather
 * than as a bare `false`, because one caller — the legacy kind-free share
 * route — has to tell "this table holds no such link" from "the server did not
 * answer" before it can decide whether the other table is worth asking.
 *
 * `loaded: false` with a `null` error is a third answer: the attempt was
 * superseded and owns nothing. It is not a failure to report and not a
 * document to act on, which is what a caller that reads the outcome has to
 * know — see {@link PersistenceService._loadAsMain}.
 */
export type LoadOutcome = { loaded: true } | { loaded: false; error: unknown };

/** How an attempt reports itself; see {@link LoadAttemptOptions.deferNotFound}. */
export interface LoadAttemptOptions {
  /**
   * Treats a `not_found` as an answer rather than a failure: nothing is
   * toasted, no blank draft is created, and the outcome comes back to the
   * caller. Set only where a second attempt follows, so that a walk over
   * candidate tables costs one report rather than one per attempt. Every other
   * failure is reported as usual, a second attempt being certain to fail the
   * same way.
   */
  deferNotFound?: boolean;
}

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
  // Bindings for component editors opened as main; tab-opened editors track
  // their own in CustomComponentService. Disposed with the main slot.
  private readonly _componentBindings = new WeakMap<
    Project,
    DefinitionBinding
  >();

  // -- Public API ----------------------------------------------------------

  loadProject(uuid: string): Promise<Project> {
    return this.server.loadProject(uuid);
  }

  /**
   * Persists a project to its backing store, dispatching on `source`. A file is
   * never a save target, only an export. A fresh `'browser'` project with no id
   * is promoted into storage here (id generated, URL becomes `/local/:id`).
   * No-op for non-dirty projects and for read-only shares.
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
    visibility?: DocumentVisibility
  ): Promise<string> {
    this._requireSignedIn();
    const { project, id } = await this.server.createProject(
      name,
      description,
      visibility
    );
    this._replaceMainProject(project);
    this.location.go(`/project/${id}`);
    this.toast.success(
      this.translation.translate('persistence.projectCreated'),
      'PersistenceService'
    );
    return id;
  }

  listProjects(page?: number, search?: string): Observable<ProjectPage> {
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

  deleteProject(uuid: string): Observable<void> {
    return this.server.deleteProject(uuid);
  }

  /**
   * Rewrites the stored blob's `name`, the summary column and, when the project
   * is open, its live metadata.
   */
  renameBrowserProject(id: string, name: string): Promise<void> {
    return this.browser.renameProject(id, name);
  }

  renameProject(uuid: string, name: string): Observable<void> {
    return this.server.renameProject(uuid, name);
  }

  /**
   * Renames the open project where it lives, dispatching by source; a
   * never-saved draft updates its metadata only and is named at its first save.
   * Component editors are not renamable inline, and shares are read-only.
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
    kind: LgDocumentKind,
    linkId: string
  ): Promise<{ project: Project; type: 'project' | 'comp' }> {
    return this.server.loadShare(kind, linkId);
  }

  /**
   * Copies a share into the viewer's own cloud library and opens the copy as
   * main. Which library the clone landed in picks the load path: a cloned
   * component reopens through {@link loadComponentAsMain}, not as a project.
   */
  async cloneShare(kind: LgDocumentKind, linkId: string): Promise<Project> {
    const { id, type } = await this.server.cloneFromShare(kind, linkId);
    if (type === 'comp') {
      await this.loadComponentAsMain(id);
    } else {
      await this.loadProjectAsMain(id);
    }
    return this.projectService.mainProject()!;
  }

  /**
   * First save of a fresh draft to the browser store. Bypasses the
   * `saveProject` dirty-guard so a pristine board can still be persisted.
   */
  async saveDraftAsLocal(project: Project, name: string): Promise<void> {
    this.metadataStore.update(project, { name });
    await this.browser.saveProject(project);
    this.analytics.capture(AnalyticsEvent.ProjectSaved, {
      source: 'browser',
      type: this.metadataStore.getMetadata(project)?.type ?? 'project'
    });
  }

  /**
   * Creates a blank project and sets it as main. It registers with an empty id
   * and is not written to storage: a draft leaves no record until its first
   * save, which generates the id and moves the URL to `/local/:id`.
   *
   * The URL moves to the root only if it is somewhere else. The startup lands
   * here for every visit that names no document, already at the root, and an
   * unconditional `go` would push a duplicate entry for Back to step onto.
   */
  createAndSetEmptyProject(): Project {
    const project = new Project();
    this.metadataStore.register(project, {
      id: '',
      name: 'Untitled',
      type: 'project',
      source: 'browser',
      visibility: 'private'
    });

    this._replaceMainProject(project);
    if (!this.location.isCurrentPathEqualTo('/')) {
      this.location.go('/');
    }
    return project;
  }

  /**
   * The name and fork attribution come from the metadata (a `Project` has
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
   * Downloads the project as a compressed `.lgix` (see {@link encodeLgix}).
   *
   * Refuses a borrowed `source:'share'` document: exporting one would let it be
   * re-imported as the user's own. The menu already hides the action; the
   * format carries no enforceable ownership, so this guard backs it up.
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
   * The same document {@link exportProjectToFile} gzips, downloaded
   * uncompressed for inspection. Debug-only; the shipped export path is
   * `.lgix`.
   */
  exportProjectToJsonFile(project: Project): void {
    const name = this.metadataStore.getMetadata(project)?.name ?? 'Untitled';
    const json = this.exportProjectToJson(project);
    const blob = new Blob([json], { type: 'application/json' });
    downloadBlob(blob, `${name}.json`);
  }

  /**
   * Imports a picked file's raw bytes, branching on the `.lgix` magic; anything
   * else is decoded as UTF-8 JSON, which covers the permanently-supported plain
   * `.json` export.
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
   * Loads file content into a new project and persists it as a browser project
   * straight away, so a reload restores it. Throws on an unreadable file rather
   * than falling back, leaving the caller to surface it; unsupported component
   * types are dropped with a warning.
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
   * Common tail of the import paths: register metadata, write a browser draft,
   * set the project as main.
   *
   * Imported customs are never adopted into the library: each resolves through
   * its provenance id to a local or cloud master when one exists, and stays an
   * embedded (restorable) snapshot otherwise. The file's fork attribution
   * travels into the metadata and the stored blob, so a later upload still
   * credits the original creators.
   */
  async persistImportedProject(
    project: Project,
    name: string,
    attribution?: FileForkAttributionV1[]
  ): Promise<void> {
    // addComponent/addWire don't push to the ActionManager, so the project
    // starts non-dirty despite having just been populated.
    this.metadataStore.register(project, {
      id: '',
      name,
      type: 'project',
      source: 'browser',
      visibility: 'private',
      attribution
    });

    // Re-encode through the file codec so the stored blob is at the current
    // format version whatever the import carried.
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
   * Shared skeleton of the load-as-main entry points. A stale result is
   * disposed; a failure toasts `failureMessageKey` and falls back to a blank
   * draft when no main project exists at all.
   */
  private async _loadAsMain<T>(
    opts: {
      /** Where the loaded document came from, for analytics. */
      source: 'server' | 'browser' | 'component' | 'share';
      load: () => Promise<T>;
      projectOf: (result: T) => Project;
      onLoaded: (result: T) => void;
      failureMessageKey: TranslationKey;
      failureDetail: string;
    } & LoadAttemptOptions
  ): Promise<LoadOutcome> {
    // One race token for every entry point: they all fill the single main
    // slot, so starting any discards a pending load of the others.
    const token = ++this._mainLoadToken;
    const isCurrent = (): boolean => token === this._mainLoadToken;
    try {
      const result = await opts.load();
      if (!isCurrent()) {
        this._disposeProject(opts.projectOf(result));
        // Not `loaded: true`: this attempt owned nothing, a newer entry point
        // having taken the slot. A caller that acts on the outcome — the
        // legacy share route, which rewrites the address bar — would otherwise
        // rewrite it to this document while the page shows the other one.
        return { loaded: false, error: null };
      }
      opts.onLoaded(result);
      // The offer reads metadata that is registered as the project is placed.
      this.wireRepair.offerRepairOnLoad(opts.projectOf(result));
      this.analytics.capture(AnalyticsEvent.ProjectLoaded, {
        source: opts.source
      });
      return { loaded: true };
    } catch (e) {
      if (!isCurrent()) {
        // Superseded, so this failure is about an attempt nobody is waiting on
        // any more: it is not reported and the caller is given no error to act
        // on — a `not_found` here would otherwise send the legacy share route
        // to the other table, whose attempt bumps the token again and discards
        // the load that superseded this one. See the success branch above.
        return { loaded: false, error: null };
      }
      // An answer rather than a failure: nothing is reported and there is no
      // blank draft to fall back to, the caller having a second attempt to
      // make. See {@link LoadAttemptOptions.deferNotFound}.
      if (opts.deferNotFound && isApiError(e, 'not_found')) {
        return { loaded: false, error: e };
      }
      this.toast.error(
        this.translation.translate(opts.failureMessageKey),
        'PersistenceService',
        `${opts.failureDetail}: ${formatHttpError(e)}`
      );
      if (!this.projectService.mainProject()) {
        this.createAndSetEmptyProject();
      }
      return { loaded: false, error: e };
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
   * Loads a share link into the main slot. A component share fills it too,
   * opening standalone as `/component/:uuid` does: as a tab it would leave the
   * main slot empty on a `/share/{kind}/{link}` page load, since the matched
   * route creates no blank draft.
   *
   * The kind is the API's, because the link no longer names a table: the
   * caller has it from its own URL and maps it once, in
   * `routing/document-kind.ts`.
   */
  async loadShareAsMain(
    kind: LgDocumentKind,
    linkId: string,
    opts?: LoadAttemptOptions
  ): Promise<LoadOutcome> {
    return this._loadAsMain({
      source: 'share',
      load: () => this.loadShare(kind, linkId),
      projectOf: ({ project }) => project,
      onLoaded: ({ project, type }) => {
        this._replaceMainProject(project);
        this.logging.info(
          `Loaded share ${kind} ${linkId} (${type})`,
          'PersistenceService'
        );
      },
      failureMessageKey: 'persistence.shareLoadFailed',
      failureDetail: `Failed to load share ${linkId}`,
      ...opts
    });
  }

  /** Rejects if no browser record exists for `id`. */
  loadLocalProject(id: string): Promise<Project> {
    return this.browser.loadProject(id);
  }

  /** Lists library masters stored in the browser (IndexedDB), newest first. */
  listBrowserComponents(): Promise<BrowserComponentSummary[]> {
    return this.browser.listComponents();
  }

  /**
   * Loads a browser-stored library master for a tab, returning the master type
   * id so the caller can attach a `DefinitionBinding`.
   */
  loadComponentForEdit(
    id: string
  ): Promise<{ project: Project; masterTypeId: number }> {
    return this.browser.loadComponentForEdit(id);
  }

  /**
   * Creates a server library master and an empty editor Project, returning the
   * master type id so the caller can attach a binding.
   */
  async createServerComponent(meta: {
    name: string;
    symbol: string;
    description: string;
    visibility?: DocumentVisibility;
  }): Promise<{ project: Project; masterTypeId: number }> {
    this._requireSignedIn();
    return this.server.createComponent(meta);
  }

  /**
   * Loads a server library master into a fresh editor Project, returning the
   * master type id so the caller can attach a binding.
   */
  loadServerComponent(
    uuid: string
  ): Promise<{ project: Project; masterTypeId: number }> {
    return this.server.loadComponent(uuid);
  }

  /**
   * Loads a server master for editing out of the session-wide circuit cache,
   * falling back to a full load for a master that is not registered yet.
   */
  loadServerComponentForEdit(
    uuid: string
  ): Promise<{ project: Project; masterTypeId: number }> {
    return this.server.loadComponentForEdit(uuid);
  }

  /**
   * Loads a server component as the main project (the `/component/:uuid`
   * route). Its `DefinitionBinding` keeps the summary current and is disposed
   * when the main slot is replaced.
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
   * Rejects a cloud save that cannot land in the right account: signed out, or
   * a document loaded under a different user. The single choke point, so it
   * toasts and throws a marker error the save flows read as already surfaced.
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
   * Rejects creating a new cloud record while signed out — the proactive
   * counterpart to the API's 401.
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
