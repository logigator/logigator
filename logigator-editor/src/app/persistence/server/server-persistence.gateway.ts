import { inject, Injectable } from '@angular/core';
import { TranslationService } from '../../translation/translation.service';
import { firstValueFrom, map, Observable, tap } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ProjectApiService } from '../../api/services/project-api.service';
import { ComponentApiService } from '../../api/services/component-api.service';
import { ShareApiService } from '../../api/services/share-api.service';
import { UserApiService } from '../../api/services/user-api.service';
import * as server from './server-circuit.codec';
import { CircuitFileService } from '../file/circuit-file.service';
import { ProjectMetadataStore } from '../project-metadata.store';
import { ToastService } from '../../logging/toast.service';
import { LoggingService } from '../../logging/logging.service';
import { Project } from '../../project/project';
import { ProjectSummary } from '../../api/models/project';
import type {
  ComponentDetail,
  ComponentSummary
} from '../../api/models/component';
import { Page } from '../../api/models/shared';
import type { CircuitFileV0 } from '../file/circuit-file.types';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { ComponentProviderService } from '../../components/component-provider.service';
import { deriveSummary } from '../../custom-component/definition-derivation';
import { buildProject, instantiateBody } from '../circuit-builder';
import type { SerializedCircuitBody } from '../serialized-circuit';
import { AuthRequiredError, formatHttpError } from '../persistence-errors';
import { BoardSnapshotService } from '../../rendering/board-snapshot.service';
import { UserService } from '../../user/user.service';
import { whenIdle } from '../../utils/scheduling';

/**
 * Longest wait for an idle slice before a preview generation starts anyway.
 * Under a free-running simulation the main thread may never report idle, and
 * a preview of stale content is worse the longer it lags behind the save.
 */
const PREVIEW_IDLE_TIMEOUT_MS = 2000;

/**
 * Parses an API ISO timestamp into epoch ms for the registry's numeric
 * `lastEdited` (which the palette sorts by), or `undefined` when absent/unparsable
 * so the registry falls back to now.
 */
function isoToEpoch(iso: string | undefined): number | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : undefined;
}

/**
 * Server transport + codec + metadata + build, returning `Project`s. Owns every
 * method coupled to the legacy positional API; the facade keeps main-slot
 * orchestration, navigation and dirty-dispatch. Deleted wholesale when the
 * native-model API ships.
 */
@Injectable({ providedIn: 'root' })
export class ServerPersistenceGateway {
  private readonly projectApi = inject(ProjectApiService);
  private readonly componentApi = inject(ComponentApiService);
  private readonly shareApi = inject(ShareApiService);
  private readonly userApi = inject(UserApiService);
  private readonly circuitFile = inject(CircuitFileService);
  private readonly registry = inject(CustomComponentRegistry);
  private readonly provider = inject(ComponentProviderService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly toast = inject(ToastService);
  private readonly logging = inject(LoggingService);
  private readonly translation = inject(TranslationService);
  private readonly snapshot = inject(BoardSnapshotService);
  private readonly userService = inject(UserService);

  /**
   * Per-session cache of a server master's last-fetched circuit body + hash,
   * keyed by the master's server uuid. Populated by the first fetch (placement
   * or edit-open) and read by both so a component is fetched from the API at
   * most once, then invalidated on save so a reopen re-reads the saved state.
   * Holds the clean persisted body — never the live editor working copy (that
   * lives on the registry definition, kept current by `DefinitionBinding`), so
   * discarded edits are never resurrected on reopen.
   */
  private readonly _masterCircuitCache = new Map<
    string,
    { body: SerializedCircuitBody; hash: string }
  >();

  async loadProject(uuid: string): Promise<Project> {
    const detail = await firstValueFrom(this.projectApi.open(uuid));
    const { components, wires } = this.circuitFile.decode(
      server.toCircuitFileV0(detail)
    );
    const project = buildProject(components, wires);

    this.metadataStore.register(project, {
      id: uuid,
      name: detail.name,
      type: 'project',
      source: 'server',
      hash: detail.elementsFile?.hash ?? '',
      isPublic: detail.public,
      link: detail.link
    });

    if (!detail.newFormat) {
      this.toast.warn(
        this.translation.translate('persistence.legacyProjectWarning'),
        'ServerPersistenceGateway'
      );
    }

    return project;
  }

  async createProject(
    name: string,
    description?: string,
    isPublic?: boolean
  ): Promise<{ project: Project; id: string }> {
    const project = new Project();
    const { id, hash } = await this._createAndSaveServerProject(
      project,
      name,
      isPublic ?? false,
      description
    );
    this.metadataStore.register(project, {
      id,
      name,
      type: 'project',
      source: 'server',
      hash,
      isPublic: isPublic ?? false
    });
    return { project, id };
  }

  /**
   * Promotes a fresh in-memory draft to a **server** project without discarding
   * its circuit or undo history: POSTs `/api/project` to create the record and
   * PUTs its current content, then flips the project's metadata to
   * `source:'server'` — but only once that round-trip commits, so a failed
   * create/PUT leaves the live project an untouched local draft (retryable)
   * rather than a half-promoted record. Returns the new server id. The
   * dirty-version snapshot guard matches {@link saveProject}: an edit landing
   * mid-promote keeps the project dirty.
   */
  async promoteToServer(
    project: Project,
    name: string,
    isPublic: boolean
  ): Promise<string> {
    const versionAtSnapshot = this.metadataStore.dirtyVersion(project);
    const { id, hash } = await this._createAndSaveServerProject(
      project,
      name,
      isPublic
    );

    this.metadataStore.update(project, {
      source: 'server',
      id,
      name,
      isPublic,
      hash
    });
    if (this.metadataStore.dirtyVersion(project) === versionAtSnapshot) {
      this.metadataStore.clearDirty(project);
    }
    void this._uploadPreview(project, id);
    return id;
  }

  /**
   * Creates a server project from an arbitrary project's current circuit — pure
   * transport, touching no metadata store, board preview or dirty state, so it is
   * safe for a throwaway project built from a stored record (uploading a
   * not-currently-open local project). Returns the new server id.
   */
  async createServerProjectFromProject(
    project: Project,
    name: string,
    isPublic: boolean
  ): Promise<string> {
    return (await this._createAndSaveServerProject(project, name, isPublic)).id;
  }

  /**
   * Creates a server project record and PUTs `project`'s current circuit into it
   * in one round-trip, returning the new id and its post-save hash. The shared
   * transport core behind create, promote and throwaway-upload; touches no
   * metadata store, board preview or dirty state.
   */
  private async _createAndSaveServerProject(
    project: Project,
    name: string,
    isPublic: boolean,
    description?: string
  ): Promise<{ id: string; hash: string }> {
    const response = await firstValueFrom(
      this.projectApi.create({
        name,
        description,
        public: isPublic ? 'true' : 'false'
      })
    );
    const { elements, dependencies } = server.serializeProject(
      project,
      this.registry,
      this.provider
    );
    const saveResponse = await firstValueFrom(
      this.projectApi.save(response.id, {
        oldHash: response.elementsFile?.hash ?? '',
        dependencies,
        elements,
        newFormat: true
      })
    );
    return { id: response.id, hash: saveResponse.elementsFile?.hash ?? '' };
  }

  listProjects(
    page?: number,
    search?: string
  ): Observable<Page<ProjectSummary>> {
    return this.projectApi.list(page ?? 0, 20, search);
  }

  deleteProject(uuid: string): Observable<void> {
    return this.projectApi.delete(uuid).pipe(map(() => undefined));
  }

  /**
   * Renames a server project via `PATCH /api/project/:id`. If the project is
   * currently open, its in-memory metadata — and thus the title bar — is synced
   * on success.
   */
  renameProject(uuid: string, name: string): Observable<void> {
    return this.projectApi.update(uuid, { name }).pipe(
      tap(() => {
        const handle = this.metadataStore.getHandleById(uuid);
        if (
          handle?.metadata.source === 'server' &&
          handle.metadata.type === 'project'
        ) {
          this.metadataStore.update(handle.project, { name });
        }
      }),
      map(() => undefined)
    );
  }

  async loadShare(
    linkId: string
  ): Promise<{ project: Project; type: 'project' | 'comp' }> {
    const detail = await firstValueFrom(this.shareApi.get(linkId));
    const { components, wires } = this.circuitFile.decode(
      server.toCircuitFileV0(detail)
    );
    const project = buildProject(components, wires);

    // Shares are read-only — disable dirty tracking subscription.
    this.metadataStore.register(
      project,
      {
        id: detail.id,
        name: detail.name,
        type: detail.type,
        source: 'share',
        hash: detail.elementsFile?.hash ?? '',
        isPublic: true,
        link: detail.link
      },
      false
    );

    return { project, type: detail.type };
  }

  async cloneFromShare(linkId: string): Promise<string> {
    try {
      await firstValueFrom(this.userApi.get());
    } catch {
      this.toast.error(
        this.translation.translate('persistence.shareAuthRequired'),
        'ServerPersistenceGateway',
        `Cannot clone share ${linkId}: user not authenticated`
      );
      throw new AuthRequiredError();
    }

    const response = await firstValueFrom(
      this.projectApi.cloneFromShare(linkId)
    );
    return response.id;
  }

  /**
   * Creates a new **server** library master: POSTs to `/api/component`, registers
   * the master (server uuid id), opens an empty editor Project (`type:'comp'`,
   * `source:'server'`), and persists the initial empty circuit to establish a
   * hash (mirroring `createProject`). Returns the Project + master type id so the
   * caller (`CustomComponentService`) opens the tab and attaches a binding.
   */
  async createComponent(meta: {
    name: string;
    symbol: string;
    description: string;
    isPublic?: boolean;
  }): Promise<{ project: Project; masterTypeId: number }> {
    const response = await firstValueFrom(
      this.componentApi.create({
        name: meta.name,
        symbol: meta.symbol,
        description: meta.description,
        public: meta.isPublic ? 'true' : 'false'
      })
    );

    const project = new Project();
    const masterTypeId = this.registry.createMaster(
      {
        id: response.id,
        version: response.version ?? 1,
        name: meta.name,
        symbol: meta.symbol,
        description: meta.description,
        link: response.link,
        isPublic: response.public
      },
      'server'
    );
    this.metadataStore.register(project, {
      id: response.id,
      name: meta.name,
      type: 'comp',
      source: 'server',
      hash: response.elementsFile?.hash ?? '',
      isPublic: meta.isPublic ?? false
    });

    try {
      const saveResponse = await this._saveComponentCircuit(
        response.id,
        project,
        response.elementsFile?.hash ?? ''
      );
      this.metadataStore.updateHash(
        project,
        saveResponse.elementsFile?.hash ?? ''
      );
    } catch (err) {
      // The component row exists on the server but the initial save failed;
      // unwind the local Project so it does not dangle (the registered master
      // stays — the registry has no unregister, and config accumulation is
      // intended). The caller surfaces the error. No binding exists yet at
      // create time, so disposing is just metadata removal + destroy.
      this.metadataStore.remove(project);
      project.destroy();
      throw err;
    }

    return { project, masterTypeId };
  }

  /**
   * Promotes a browser master to the server library: POSTs `/api/component` to
   * mint the record, then PUTs the given (temp) project's circuit — embedding a
   * self-contained snapshot of every custom it places, exactly like a normal
   * component save. Returns the new server id + save-time version. The caller owns
   * flipping the registry/metadata and removing the browser record; this method is
   * pure transport (no local state changes), so a failed POST/PUT leaves nothing
   * to unwind. Returns the new server id, save-time version, and content hash (so
   * the caller can re-point an open editor's metadata).
   */
  async promoteComponentFromProject(
    project: Project,
    meta: {
      name: string;
      symbol: string;
      description: string;
      isPublic?: boolean;
    }
  ): Promise<{
    id: string;
    version: number;
    hash: string;
    link?: string;
    isPublic: boolean;
  }> {
    const response = await firstValueFrom(
      this.componentApi.create({
        name: meta.name,
        symbol: meta.symbol,
        description: meta.description,
        public: meta.isPublic ? 'true' : 'false'
      })
    );

    const saveResponse = await this._saveComponentCircuit(
      response.id,
      project,
      response.elementsFile?.hash ?? ''
    );

    return {
      id: response.id,
      version: saveResponse.version ?? response.version ?? 1,
      hash: saveResponse.elementsFile?.hash ?? '',
      link: response.link,
      isPublic: response.public
    };
  }

  /**
   * Loads a **server** library master into a fresh editor Project (the universal
   * embedded-snapshot path: the response's `dependencies[].snapshot` are revived
   * by the `v0ToV1` migration, so no extra fetches). Registers the master,
   * reusing its session type id if already known. Returns the Project + master
   * type id for the caller to open a tab / set as main and attach a binding.
   */
  async loadComponent(
    uuid: string
  ): Promise<{ project: Project; masterTypeId: number }> {
    const detail = await firstValueFrom(this.componentApi.open(uuid));
    const { components, wires } = this.circuitFile.decode(
      this._componentDetailToV0(detail)
    );
    const project = buildProject(components, wires);

    const masterTypeId =
      this.registry.masterTypeIdForId(uuid) ??
      this.registry.createMaster(
        {
          id: uuid,
          version: detail.version ?? 1,
          name: detail.name,
          symbol: detail.symbol,
          description: detail.description,
          numInputs: detail.numInputs,
          numOutputs: detail.numOutputs,
          labels: detail.labels,
          link: detail.link,
          isPublic: detail.public,
          lastEdited: isoToEpoch(detail.lastEdited)
        },
        'server'
      );

    this.metadataStore.register(project, {
      id: uuid,
      name: detail.name,
      type: 'comp',
      source: 'server',
      hash: detail.elementsFile?.hash ?? '',
      isPublic: detail.public
    });

    return { project, masterTypeId };
  }

  /**
   * Registers every cloud (server) library master into the registry at startup so
   * they show in the palette and resolve through the promotion alias map after a
   * reload (the alias points at a server id that must be loaded to be useful).
   *
   * Uses only the list response (`GET /api/component`) — one request, no circuits.
   * The summary carries everything a master needs except its circuit body, which
   * is fetched lazily on first placement / update (see
   * {@link PersistenceService.ensureServerMasterCircuit}). Best-effort: skips when
   * unauthenticated/offline (the list call fails). Masters already known (loaded by
   * an open project) are left alone.
   */
  async preloadServerMasters(): Promise<void> {
    let summaries;
    try {
      summaries = await firstValueFrom(this.componentApi.list());
    } catch (err) {
      // Usually not authenticated (401) or offline — no cloud library to
      // preload. Logged at debug so a genuine failure is still traceable
      // without nagging signed-out users.
      this.logging.debug(
        `Server master preload skipped: ${formatHttpError(err)}`,
        'ServerPersistenceGateway'
      );
      return;
    }

    for (const summary of summaries) {
      if (this.registry.masterTypeIdForId(summary.id) !== undefined) continue;
      this.registry.createMaster(
        {
          id: summary.id,
          version: summary.version ?? 1,
          name: summary.name,
          symbol: summary.symbol,
          description: summary.description,
          numInputs: summary.numInputs,
          numOutputs: summary.numOutputs,
          labels: summary.labels,
          link: summary.link,
          isPublic: summary.public,
          lastEdited: isoToEpoch(summary.lastEdited)
          // circuit omitted — loaded on demand by ensureServerMasterCircuit
        },
        'server'
      );
    }
  }

  /**
   * Fetches a server component's circuit body (GET `/api/component/:id`) for lazy
   * hydration of a summary-only master. Used the first time a preloaded cloud
   * master is placed or updated. Served from {@link _masterCircuitCache} when the
   * master was already fetched this session (placement or edit-open).
   */
  async loadComponentCircuit(uuid: string): Promise<SerializedCircuitBody> {
    return (await this._fetchMasterCircuit(uuid)).body;
  }

  /**
   * The single fetch-once primitive behind placement and edit-open: returns the
   * master's circuit body + elements hash, fetching (and ingesting its embedded
   * snapshots) exactly once per session and caching the result. A cache hit skips
   * the GET and re-ingest — the snapshots are already registered.
   */
  private async _fetchMasterCircuit(
    uuid: string
  ): Promise<{ body: SerializedCircuitBody; hash: string }> {
    const cached = this._masterCircuitCache.get(uuid);
    if (cached) return cached;
    const detail = await firstValueFrom(this.componentApi.open(uuid));
    const entry = {
      body: this.circuitFile.decodeToBodyFromData(
        this._componentDetailToV0(detail)
      ),
      hash: detail.elementsFile?.hash ?? ''
    };
    this._masterCircuitCache.set(uuid, entry);
    return entry;
  }

  /**
   * Loads an already-registered server master into a fresh editor Project from
   * the shared circuit cache (a single GET across placement and every edit-open),
   * mirroring {@link loadComponent} but without a redundant fetch. The master's
   * summary is read from the registry (it is preloaded before it can be edited);
   * the metadata hash comes from the cached fetch so saves keep their optimistic
   * concurrency check. Falls back to {@link loadComponent} when the master is not
   * registered (a direct deep link that outraced the preload).
   */
  async loadComponentForEdit(
    uuid: string
  ): Promise<{ project: Project; masterTypeId: number }> {
    const masterTypeId = this.registry.masterTypeIdForId(uuid);
    const def =
      masterTypeId !== undefined
        ? this.registry.getDefinition(masterTypeId)
        : undefined;
    if (masterTypeId === undefined || def?.kind !== 'master') {
      return this.loadComponent(uuid);
    }

    const { body, hash } = await this._fetchMasterCircuit(uuid);
    const { components, wires } = instantiateBody(this.provider, body);
    const project = buildProject(components, wires);

    this.metadataStore.register(project, {
      id: uuid,
      name: def.name,
      type: 'comp',
      source: 'server',
      hash,
      isPublic: def.isPublic ?? false
    });

    return { project, masterTypeId };
  }

  /**
   * Drops the cached circuits, e.g. on logout when the server masters are removed
   * from the registry and their session type ids retired — a stale cached body
   * would hold ids the registry no longer knows.
   */
  clearMasterCircuitCache(): void {
    this._masterCircuitCache.clear();
  }

  async saveProject(project: Project): Promise<void> {
    // Snapshot the dirty version *before* serializing: an edit landing
    // mid-save must stay dirty, else "Saved" lies about unsaved changes.
    const metadata = this.metadataStore.getMetadata(project)!;
    const versionAtSnapshot = this.metadataStore.dirtyVersion(project);
    const { elements, dependencies } = server.serializeProject(
      project,
      this.registry,
      this.provider
    );

    try {
      const response = await firstValueFrom(
        this.projectApi.save(metadata.id, {
          oldHash: metadata.hash,
          dependencies,
          elements,
          newFormat: true
        })
      );

      this.metadataStore.updateHash(project, response.elementsFile?.hash ?? '');
      if (this.metadataStore.dirtyVersion(project) === versionAtSnapshot) {
        this.metadataStore.clearDirty(project);
      }
      this.toast.success(
        this.translation.translate('persistence.projectSaved'),
        'ServerPersistenceGateway'
      );
      void this._uploadPreview(project, metadata.id);
    } catch (err) {
      this._reportSaveError(err);
      throw err;
    }
  }

  /**
   * Saves a custom-component editor (`type: 'comp'`, `source: 'server'`) to the
   * server: `PUT /api/component/:id` with its recomputed summary
   * ({@link deriveSummary}) plus the positional body + embedded snapshots
   * (`serializeProject`). Adopts the server-returned `version` (the save-time
   * stamp) when present. Does not retroactively change placed instances — they
   * are frozen snapshots; this only affects future placements and explicit
   * per-instance updates.
   */
  async saveComponent(project: Project): Promise<void> {
    const metadata = this.metadataStore.getMetadata(project)!;
    const masterTypeId = this.registry.masterTypeIdForId(metadata.id);
    const versionAtSnapshot = this.metadataStore.dirtyVersion(project);

    try {
      const response = await this._saveComponentCircuit(
        metadata.id,
        project,
        metadata.hash
      );

      // The persisted state changed: drop the cached body/hash so the next
      // placement or edit-open re-fetches the saved circuit rather than serving
      // the pre-save copy.
      this._masterCircuitCache.delete(metadata.id);

      this.metadataStore.updateHash(project, response.elementsFile?.hash ?? '');
      // Adopt the server's save-time version stamp; without it (e.g. a backend
      // that does not yet implement the additive change) the master version is
      // left unchanged, so placed instances are not spuriously flagged stale.
      if (masterTypeId !== undefined) {
        if (response.version !== undefined) {
          this.registry.setMasterVersion(masterTypeId, response.version);
        }
        // Re-stamp the save time (server value when present, else now) so the
        // palette re-sorts the just-edited master to the top.
        this.registry.setMasterLastEdited(
          masterTypeId,
          isoToEpoch(response.lastEdited)
        );
      }
      if (this.metadataStore.dirtyVersion(project) === versionAtSnapshot) {
        this.metadataStore.clearDirty(project);
      }
      this.toast.success(
        this.translation.translate('persistence.componentSaved'),
        'ServerPersistenceGateway'
      );
    } catch (err) {
      this._reportSaveError(err);
      throw err;
    }
  }

  /**
   * Toasts a failed project/component save with the most specific message
   * available. A 401 means the server session expired underneath a still-true
   * auth cookie — flip to signed-out (which also clears the auth cookie and,
   * via the session lifecycle, the cloud library) and tell the user to log in
   * again; the unsaved changes stay dirty in the editor.
   */
  private _reportSaveError(err: unknown): void {
    if (err instanceof HttpErrorResponse && err.status === 401) {
      this.userService.sessionExpired();
      this.toast.error(
        this.translation.translate('session.saveLoggedOut'),
        'ServerPersistenceGateway',
        err
      );
    } else if (this._isVersionMismatch(err)) {
      this.toast.error(
        this.translation.translate('persistence.versionMismatch'),
        'ServerPersistenceGateway',
        err
      );
    } else {
      this.toast.error(
        this.translation.translate('persistence.saveFailed', {
          detail: formatHttpError(err)
        }),
        'ServerPersistenceGateway',
        err
      );
    }
  }

  /**
   * Serializes `project` and PUTs it to `/api/component/:id` — the shared
   * create/save/promote tail: derive the summary, embed a self-contained snapshot
   * of every custom it places, and push. Returns the save response (new hash +
   * version). Pure transport; the caller owns metadata/registry/dirty handling.
   */
  private _saveComponentCircuit(
    componentId: string,
    project: Project,
    oldHash: string
  ): Promise<ComponentSummary> {
    const summary = deriveSummary(project);
    const { elements, dependencies } = server.serializeProject(
      project,
      this.registry,
      this.provider
    );
    return firstValueFrom(
      this.componentApi.save(componentId, {
        oldHash,
        dependencies,
        elements,
        numInputs: summary.numInputs,
        numOutputs: summary.numOutputs,
        labels: summary.labels,
        newFormat: true
      })
    );
  }

  /**
   * Wraps a component detail response as a {@link CircuitFileV0} envelope so it
   * routes through the permanent `v0ToV1` migration — shared by the full load
   * ({@link loadComponent}) and the lazy circuit hydration
   * ({@link loadComponentCircuit}).
   */
  private _componentDetailToV0(detail: ComponentDetail): CircuitFileV0 {
    return server.toCircuitFileV0({
      name: detail.name,
      elements: detail.elements,
      dependencies: detail.dependencies
    });
  }

  /**
   * Renders and uploads dark + light project thumbnails after a successful
   * server save. Fire-and-forget: a preview is a nice-to-have, so any failure
   * is logged and swallowed rather than surfaced or allowed to fail the save.
   * Order matters — the backend maps `previews[0]` to the dark slot and
   * `previews[1]` to the light slot.
   */
  private async _uploadPreview(
    project: Project,
    projectId: string
  ): Promise<void> {
    try {
      // A preview is cosmetic — wait for an idle slice so the generation
      // cost never stacks onto the frames doing the save's own UI work.
      await whenIdle(PREVIEW_IDLE_TIMEOUT_MS);
      const previews = await this.snapshot.generatePreviews(project);
      if (!previews) return;
      const formData = new FormData();
      formData.append('previews', previews.dark, 'preview-dark.png');
      formData.append('previews', previews.light, 'preview-light.png');
      await firstValueFrom(this.projectApi.updatePreviews(projectId, formData));
    } catch (err) {
      this.logging.warn(
        `Preview upload failed: ${formatHttpError(err)}`,
        'ServerPersistenceGateway'
      );
    }
  }

  private _isVersionMismatch(err: unknown): boolean {
    return (
      err instanceof HttpErrorResponse &&
      err.status === 400 &&
      (err.error as { message?: string })?.message === 'VersionMismatch'
    );
  }
}
