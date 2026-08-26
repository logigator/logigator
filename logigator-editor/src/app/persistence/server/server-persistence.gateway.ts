import { inject, Injectable } from '@angular/core';
import { TranslationService } from '../../translation/translation.service';
import { firstValueFrom, map, Observable, tap } from 'rxjs';
import { ProjectApiService } from '../../api/services/project-api.service';
import { ComponentApiService } from '../../api/services/component-api.service';
import { ShareApiService } from '../../api/services/share-api.service';
import { isApiError } from '../../api/api-error';
import { CircuitFileService } from '../file/circuit-file.service';
import { ProjectMetadataStore } from '../project-metadata.store';
import { ToastService } from '../../logging/toast.service';
import { LoggingService } from '../../logging/logging.service';
import { Project } from '../../project/project';
import type { ProjectPage, ProjectSummary } from '@logigator/contract';
import {
  type CustomComponentDetails,
  type FileForkAttributionV1,
  type SerializedCircuitBody
} from '@logigator/core';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { ComponentProviderService } from '../../components/component-provider.service';
import { buildProject, instantiateBody } from '../circuit-builder';
import { warnSkippedCustoms } from '../load-warnings';
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
 * Page size for the startup walk over the cloud library. The API caps a page at
 * a hundred rows, so the preload asks for the largest page it will serve and
 * pages until it has them all.
 */
const LIBRARY_PAGE_SIZE = 100;

/** Page size the Open dialog lists cloud projects at. */
const PROJECT_PAGE_SIZE = 20;

/**
 * Parses an API ISO timestamp into epoch ms for the registry's numeric
 * `lastEdited` (which the palette sorts by), or `undefined` when unparsable
 * so the registry falls back to now.
 */
function isoToEpoch(iso: string): number | undefined {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : undefined;
}

/**
 * The API answers an empty lineage with an empty array; the file format spells
 * "not a fork" as an absent field. Normalizing here keeps the difference out of
 * everything downstream, which only ever asks for the last entry.
 */
function toMetadataAttribution(
  chain: FileForkAttributionV1[]
): FileForkAttributionV1[] | undefined {
  return chain.length > 0 ? chain : undefined;
}

/**
 * Server transport + codec + metadata + build, returning `Project`s. Owns every
 * method that talks to the cloud API; the facade keeps main-slot orchestration,
 * navigation and dirty-dispatch.
 *
 * The wire format is the **native versioned document** — the same one a `.lgix`
 * export carries — so encoding is `CircuitFileService.toDocument` and decoding
 * is `CircuitFileService.decode`, exactly as for a local file. There is no
 * server-specific codec any more.
 *
 * Concurrency is the document's integer `version`: a read hands one back, a
 * save presents it, and a write that lost the race answers `version_conflict`
 * rather than being merged.
 */
@Injectable({ providedIn: 'root' })
export class ServerPersistenceGateway {
  private readonly projectApi = inject(ProjectApiService);
  private readonly componentApi = inject(ComponentApiService);
  private readonly shareApi = inject(ShareApiService);
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
   * Per-session cache of a server master's last-fetched circuit body + version,
   * keyed by the master's server uuid. Populated by the first fetch (placement
   * or edit-open) and read by both so a component is fetched from the API at
   * most once, then invalidated on save so a reopen re-reads the saved state.
   * Holds the clean persisted body — never the live editor working copy (that
   * lives on the registry definition, kept current by `DefinitionBinding`), so
   * discarded edits are never resurrected on reopen.
   */
  private readonly _masterCircuitCache = new Map<
    string,
    { body: SerializedCircuitBody; version: number }
  >();

  async loadProject(uuid: string): Promise<Project> {
    const detail = await firstValueFrom(this.projectApi.open(uuid));
    const { components, wires, skippedCustom } = this.circuitFile.decode(
      detail.document
    );
    warnSkippedCustoms(
      this.toast,
      this.translation,
      skippedCustom,
      'ServerPersistenceGateway'
    );
    const project = buildProject(components, wires);

    this.metadataStore.register(project, {
      id: uuid,
      name: detail.name,
      type: 'project',
      source: 'server',
      version: detail.version,
      isPublic: detail.public,
      link: detail.link,
      attribution: toMetadataAttribution(detail.attribution)
    });

    return project;
  }

  async createProject(
    name: string,
    description?: string,
    isPublic?: boolean
  ): Promise<{ project: Project; id: string }> {
    const project = new Project();
    const summary = await firstValueFrom(
      this.projectApi.create({ name, description, public: isPublic ?? false })
    );
    this.metadataStore.register(project, {
      id: summary.id,
      name,
      type: 'project',
      source: 'server',
      version: summary.version,
      isPublic: summary.public,
      link: summary.link
    });
    return { project, id: summary.id };
  }

  /**
   * Promotes a fresh in-memory draft to a **server** project without discarding
   * its circuit or undo history: one `POST /api/projects` carrying the document,
   * then flips the project's metadata to `source:'server'` — but only once that
   * round-trip commits, so a failed create leaves the live project an untouched
   * local draft (retryable) rather than a half-promoted record. Returns the new
   * server id. Runs under the same mid-save edit guard as {@link saveProject}:
   * an edit landing mid-promote keeps the project dirty.
   */
  async promoteToServer(
    project: Project,
    name: string,
    isPublic: boolean
  ): Promise<string> {
    const attribution = this.metadataStore.getMetadata(project)?.attribution;
    const id = await this.metadataStore.withDirtyGuard(project, async () => {
      const summary = await this._createServerProject(project, name, isPublic, {
        attribution
      });

      this.metadataStore.update(project, {
        source: 'server',
        id: summary.id,
        name,
        isPublic: summary.public,
        version: summary.version,
        link: summary.link
      });
      return summary.id;
    });
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
    isPublic: boolean,
    attribution?: FileForkAttributionV1[]
  ): Promise<string> {
    const summary = await this._createServerProject(project, name, isPublic, {
      attribution
    });
    return summary.id;
  }

  /**
   * Creates a server project record with `project`'s current circuit already in
   * it — one round trip, because a create carries its document. The shared
   * transport core behind create-from-draft, promote and throwaway-upload;
   * touches no metadata store, board preview or dirty state.
   *
   * `opts.attribution` is how fork lineage survives an upload: the server reads
   * the chain's last entry out of the document, checks it against its own rows
   * and links `forkedFrom` from that. There is no request field for it — the
   * claim travels inside the document it describes.
   */
  private _createServerProject(
    project: Project,
    name: string,
    isPublic: boolean,
    opts?: { description?: string; attribution?: FileForkAttributionV1[] }
  ): Promise<ProjectSummary> {
    const { file } = this.circuitFile.toDocument(
      project,
      name,
      opts?.attribution
    );
    return firstValueFrom(
      this.projectApi.create({
        name,
        description: opts?.description,
        public: isPublic,
        document: file
      })
    );
  }

  listProjects(page?: number, search?: string): Observable<ProjectPage> {
    return this.projectApi.list(page ?? 0, PROJECT_PAGE_SIZE, search);
  }

  deleteProject(uuid: string): Observable<void> {
    return this.projectApi.delete(uuid);
  }

  /** Deletes (unpublishes) a server library component via the API. */
  deleteComponent(uuid: string): Observable<void> {
    return this.componentApi.delete(uuid);
  }

  /**
   * Updates a server component's descriptive metadata via
   * `PATCH /api/components/:id`. Name, symbol and description travel in placed
   * snapshots, so the server bumps the monotonic `version` and re-stamps the
   * last-edited time; both are emitted for the registry to mirror, which is what
   * offers instances frozen at an older version an update.
   */
  updateComponentDetails(
    uuid: string,
    details: CustomComponentDetails
  ): Observable<{ version?: number; lastEdited?: number }> {
    return this.componentApi.update(uuid, details).pipe(
      map((summary) => ({
        version: summary.version,
        lastEdited: isoToEpoch(summary.lastEditedAt)
      }))
    );
  }

  /**
   * Renames a server project via `PATCH /api/projects/:id`. A rename is content
   * the server stamps, so it bumps `version`; if the project is currently open,
   * its in-memory metadata — the title bar, and the counter the next save
   * presents — is synced on success.
   */
  renameProject(uuid: string, name: string): Observable<void> {
    return this.projectApi.update(uuid, { name }).pipe(
      tap((summary) => {
        const handle = this.metadataStore.getHandleById(uuid);
        if (
          handle?.metadata.source === 'server' &&
          handle.metadata.type === 'project'
        ) {
          this.metadataStore.update(handle.project, {
            name,
            version: summary.version
          });
        }
      }),
      map(() => undefined)
    );
  }

  async loadShare(
    linkId: string
  ): Promise<{ project: Project; type: 'project' | 'comp' }> {
    const detail = await firstValueFrom(this.shareApi.read(linkId));
    const summary =
      detail.kind === 'project' ? detail.project : detail.component;
    const type = detail.kind === 'project' ? 'project' : 'comp';
    const { components, wires, skippedCustom } = this.circuitFile.decode(
      detail.document
    );
    warnSkippedCustoms(
      this.toast,
      this.translation,
      skippedCustom,
      'ServerPersistenceGateway'
    );
    const project = buildProject(components, wires);

    // Shares are read-only — disable dirty tracking subscription, and carry no
    // version: nothing here will ever present one.
    this.metadataStore.register(
      project,
      {
        id: summary.id,
        name: summary.name,
        type,
        source: 'share',
        isPublic: summary.public,
        // The link is what this share was fetched by; the clone action reuses it.
        link: linkId,
        attribution: toMetadataAttribution(detail.attribution)
      },
      false
    );

    return { project, type };
  }

  /**
   * Clones a share into the signed-in user's own library, returning the copy's
   * id and which library it landed in. One endpoint for both kinds — the link
   * already says what it points at, so the caller no longer has to.
   */
  async cloneFromShare(
    linkId: string
  ): Promise<{ id: string; type: 'project' | 'comp' }> {
    try {
      const response = await firstValueFrom(this.shareApi.clone(linkId));
      return response.kind === 'project'
        ? { id: response.project.id, type: 'project' }
        : { id: response.component.id, type: 'comp' };
    } catch (err) {
      // Cloning writes into an account, so it is the one half of sharing that
      // needs a session. The API says so; nothing is asked in advance.
      if (isApiError(err, 'unauthorized')) {
        this.toast.error(
          this.translation.translate('persistence.shareAuthRequired'),
          'ServerPersistenceGateway',
          `Cannot clone share ${linkId}: user not authenticated`
        );
        throw new AuthRequiredError();
      }
      throw err;
    }
  }

  /**
   * Creates a new **server** library master: one `POST /api/components`
   * establishing the record and its version, then registers the master (server
   * uuid id) and opens an empty editor Project (`type:'comp'`,
   * `source:'server'`). Returns the Project + master type id so the caller
   * (`CustomComponentService`) opens the tab and attaches a binding.
   */
  async createComponent(meta: {
    name: string;
    symbol: string;
    description: string;
    isPublic?: boolean;
  }): Promise<{ project: Project; masterTypeId: number }> {
    const summary = await firstValueFrom(
      this.componentApi.create({
        name: meta.name,
        symbol: meta.symbol,
        description: meta.description,
        public: meta.isPublic ?? false
      })
    );

    const project = new Project();
    const masterTypeId = this.registry.createMaster(
      {
        id: summary.id,
        version: summary.version,
        name: meta.name,
        symbol: meta.symbol,
        description: meta.description,
        link: summary.link,
        isPublic: summary.public
      },
      'server'
    );
    this.metadataStore.register(project, {
      id: summary.id,
      name: meta.name,
      type: 'comp',
      source: 'server',
      version: summary.version,
      isPublic: summary.public
    });

    return { project, masterTypeId };
  }

  /**
   * Promotes a browser master to the server library: one `POST /api/components`
   * carrying the given (temp) project's circuit — embedding a self-contained
   * snapshot of every custom it places, exactly like a normal component save.
   * The caller owns flipping the registry/metadata and removing the browser
   * record; this method is pure transport (no local state changes), so a failed
   * create leaves nothing to unwind. Returns the new server id, its version and
   * its share details, so the caller can re-point an open editor's metadata.
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
    link?: string;
    isPublic: boolean;
  }> {
    const { file } = this.circuitFile.toDocument(project, meta.name);
    const summary = await firstValueFrom(
      this.componentApi.create({
        name: meta.name,
        symbol: meta.symbol,
        description: meta.description,
        public: meta.isPublic ?? false,
        document: file
      })
    );

    return {
      id: summary.id,
      version: summary.version,
      link: summary.link,
      isPublic: summary.public
    };
  }

  /**
   * Loads a **server** library master into a fresh editor Project (the universal
   * embedded-snapshot path: the document embeds every custom it places, so no
   * extra fetches). Registers the master, reusing its session type id if already
   * known. Returns the Project + master type id for the caller to open a tab /
   * set as main and attach a binding.
   */
  async loadComponent(
    uuid: string
  ): Promise<{ project: Project; masterTypeId: number }> {
    const detail = await firstValueFrom(this.componentApi.open(uuid));
    const { components, wires, skippedCustom } = this.circuitFile.decode(
      detail.document
    );
    warnSkippedCustoms(
      this.toast,
      this.translation,
      skippedCustom,
      'ServerPersistenceGateway'
    );
    const project = buildProject(components, wires);

    const masterTypeId =
      this.registry.masterTypeIdForId(uuid) ??
      this.registry.createMaster(
        {
          id: uuid,
          version: detail.version,
          name: detail.name,
          symbol: detail.symbol,
          description: detail.description,
          numInputs: detail.numInputs,
          numOutputs: detail.numOutputs,
          labels: detail.labels,
          link: detail.link,
          isPublic: detail.public,
          lastEdited: isoToEpoch(detail.lastEditedAt)
        },
        'server'
      );

    this.metadataStore.register(project, {
      id: uuid,
      name: detail.name,
      type: 'comp',
      source: 'server',
      version: detail.version,
      isPublic: detail.public
    });

    return { project, masterTypeId };
  }

  /**
   * Registers every cloud (server) library master into the registry at startup so
   * they show in the palette and resolve through the promotion alias map after a
   * reload (the alias points at a server id that must be loaded to be useful).
   *
   * Walks `GET /api/components` page by page — the listing is bounded, so the
   * whole library is several requests rather than one unbounded read, and none
   * of them carry a circuit. The summary carries everything a master needs
   * except its circuit body, which is fetched lazily on first placement / update
   * (see {@link PersistenceService.ensureServerMasterCircuit}). Best-effort:
   * skips when unauthenticated/offline (the list call fails). Masters already
   * known (loaded by an open project) are left alone.
   */
  async preloadServerMasters(): Promise<void> {
    let page = 0;
    let loaded = 0;

    for (;;) {
      let result;
      try {
        result = await firstValueFrom(
          this.componentApi.list(page, LIBRARY_PAGE_SIZE)
        );
      } catch (err) {
        // Usually not authenticated (401) or offline — no cloud library to
        // preload. Logged at debug so a genuine failure is still traceable
        // without nagging signed-out users.
        this.logging.debug(
          `Server master preload stopped at page ${page}: ${formatHttpError(err)}`,
          'ServerPersistenceGateway'
        );
        return;
      }

      for (const summary of result.entries) {
        if (this.registry.masterTypeIdForId(summary.id) !== undefined) continue;
        this.registry.createMaster(
          {
            id: summary.id,
            version: summary.version,
            name: summary.name,
            symbol: summary.symbol,
            description: summary.description,
            numInputs: summary.numInputs,
            numOutputs: summary.numOutputs,
            labels: summary.labels,
            link: summary.link,
            isPublic: summary.public,
            lastEdited: isoToEpoch(summary.lastEditedAt)
            // circuit omitted — loaded on demand by ensureServerMasterCircuit
          },
          'server'
        );
      }

      loaded += result.entries.length;
      page++;
      // An empty page ends the walk whatever the count says: a component
      // deleted while the walk was in flight would otherwise loop forever.
      if (result.entries.length === 0 || loaded >= result.total) return;
    }
  }

  /**
   * Fetches a server component's circuit body (`GET /api/components/:id`) for
   * lazy hydration of a summary-only master. Used the first time a preloaded
   * cloud master is placed or updated. Served from {@link _masterCircuitCache}
   * when the master was already fetched this session (placement or edit-open).
   */
  async loadComponentCircuit(uuid: string): Promise<SerializedCircuitBody> {
    return (await this._fetchMasterCircuit(uuid)).body;
  }

  /**
   * The single fetch-once primitive behind placement and edit-open: returns the
   * master's circuit body + version, fetching (and ingesting its embedded
   * snapshots) exactly once per session and caching the result. A cache hit skips
   * the GET and re-ingest — the snapshots are already registered.
   */
  private async _fetchMasterCircuit(
    uuid: string
  ): Promise<{ body: SerializedCircuitBody; version: number }> {
    const cached = this._masterCircuitCache.get(uuid);
    if (cached) return cached;
    const detail = await firstValueFrom(this.componentApi.open(uuid));
    const entry = {
      body: this.circuitFile.decodeToBodyFromData(detail.document),
      version: detail.version
    };
    this._masterCircuitCache.set(uuid, entry);
    return entry;
  }

  /**
   * Loads an already-registered server master into a fresh editor Project from
   * the shared circuit cache (a single GET across placement and every edit-open),
   * mirroring {@link loadComponent} but without a redundant fetch. The master's
   * summary is read from the registry (it is preloaded before it can be edited);
   * the metadata version comes from the cached fetch so saves keep their
   * optimistic concurrency check. Falls back to {@link loadComponent} when the
   * master is not registered (a direct deep link that outraced the preload).
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

    const { body, version } = await this._fetchMasterCircuit(uuid);
    const { components, wires } = instantiateBody(this.provider, body);
    const project = buildProject(components, wires);

    this.metadataStore.register(project, {
      id: uuid,
      name: def.name,
      type: 'comp',
      source: 'server',
      version,
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
    const metadata = this.metadataStore.getMetadata(project)!;
    await this.metadataStore.withDirtyGuard(project, async () => {
      const { file } = this.circuitFile.toDocument(project, metadata.name);

      try {
        const summary = await firstValueFrom(
          this.projectApi.save(metadata.id, {
            document: file,
            version: metadata.version ?? 1
          })
        );
        this.metadataStore.updateVersion(project, summary.version);
      } catch (err) {
        this._reportSaveError(err);
        throw err;
      }
    });
    this.toast.success(
      this.translation.translate('persistence.projectSaved'),
      'ServerPersistenceGateway'
    );
    void this._uploadPreview(project, metadata.id);
  }

  /**
   * Saves a custom-component editor (`type: 'comp'`, `source: 'server'`) to the
   * server: `PUT /api/components/:id` with the native document, which embeds a
   * self-contained snapshot of every custom it places. The port surface is
   * derived server-side from that document rather than declared here — the
   * plugs in the circuit are what a component's ports *are*, so a client
   * asserting them could only ever disagree with the circuit it sent. Adopts the
   * server's save-time `version`. Does not retroactively change placed instances
   * — they are frozen snapshots; this only affects future placements and
   * explicit per-instance updates.
   */
  async saveComponent(project: Project): Promise<void> {
    const metadata = this.metadataStore.getMetadata(project)!;
    const masterTypeId = this.registry.masterTypeIdForId(metadata.id);

    await this.metadataStore.withDirtyGuard(project, async () => {
      const { file } = this.circuitFile.toDocument(project, metadata.name);

      try {
        const summary = await firstValueFrom(
          this.componentApi.save(metadata.id, {
            document: file,
            version: metadata.version ?? 1
          })
        );

        // The persisted state changed: drop the cached body/version so the next
        // placement or edit-open re-fetches the saved circuit rather than serving
        // the pre-save copy.
        this._masterCircuitCache.delete(metadata.id);

        this.metadataStore.updateVersion(project, summary.version);
        if (masterTypeId !== undefined) {
          this.registry.setMasterVersion(masterTypeId, summary.version);
          // Re-stamp the save time so the palette re-sorts the just-edited
          // master to the top.
          this.registry.setMasterLastEdited(
            masterTypeId,
            isoToEpoch(summary.lastEditedAt)
          );
        }
      } catch (err) {
        this._reportSaveError(err);
        throw err;
      }
    });
    this.toast.success(
      this.translation.translate('persistence.componentSaved'),
      'ServerPersistenceGateway'
    );
  }

  /**
   * Toasts a failed project/component save with the most specific message
   * available, branching on the API's own error code rather than on the status:
   * several failures share a status, and the message is human-facing.
   *
   * `unauthorized` means the server session is gone underneath a still-true auth
   * cookie — flip to signed-out (which also clears the cookie and, via the
   * session lifecycle, the cloud library) and tell the user to log in again; the
   * unsaved changes stay dirty in the editor.
   */
  private _reportSaveError(err: unknown): void {
    if (isApiError(err, 'unauthorized')) {
      this.userService.sessionExpired();
      this.toast.error(
        this.translation.translate('session.saveLoggedOut'),
        'ServerPersistenceGateway',
        err
      );
    } else if (isApiError(err, 'version_conflict')) {
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
   * Renders and uploads both theme thumbnails after a successful server save.
   * Fire-and-forget: a preview is a nice-to-have, so any failure is logged and
   * swallowed rather than surfaced or allowed to fail the save. The parts are
   * named for the theme each shows, so neither side depends on their order.
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
      formData.append('light', previews.light, 'preview-light.png');
      formData.append('dark', previews.dark, 'preview-dark.png');
      await firstValueFrom(this.projectApi.setPreview(projectId, formData));
    } catch (err) {
      this.logging.warn(
        `Preview upload failed: ${formatHttpError(err)}`,
        'ServerPersistenceGateway'
      );
    }
  }
}
