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
 * Longest wait for an idle slice before preview generation starts anyway: a
 * free-running simulation may never leave the main thread idle.
 */
const PREVIEW_IDLE_TIMEOUT_MS = 2000;

/** The API's page cap, so the library preload makes the fewest requests. */
const LIBRARY_PAGE_SIZE = 100;

/** Page size the Open dialog lists cloud projects at. */
const PROJECT_PAGE_SIZE = 20;

/**
 * Epoch ms for the registry's numeric `lastEdited`, or `undefined` when
 * unparsable, which makes the registry fall back to now.
 */
function isoToEpoch(iso: string): number | undefined {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : undefined;
}

/**
 * The API spells "not a fork" as an empty array, the file format as an absent
 * field.
 */
function toMetadataAttribution(
  chain: FileForkAttributionV1[]
): FileForkAttributionV1[] | undefined {
  return chain.length > 0 ? chain : undefined;
}

/**
 * Server transport + codec + metadata + build, returning `Project`s. The
 * facade keeps main-slot orchestration, navigation and dirty-dispatch.
 *
 * The wire format is the native versioned document, the same one a `.lgix`
 * export carries, so this gateway has no codec of its own: it encodes with
 * `CircuitFileService.toDocument` and decodes with `CircuitFileService.decode`.
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
   * Per-session cache of a server master's circuit body + version by server
   * uuid, so a master is fetched at most once; invalidated on save. Holds the
   * clean persisted body, never the live working copy (that lives on the
   * registry definition), so discarded edits are not resurrected on reopen.
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
   * Promotes a fresh in-memory draft to a server project without discarding
   * its circuit or undo history. Metadata flips to `source:'server'` only once
   * the create commits, so a failure leaves an untouched, retryable local
   * draft. An edit landing mid-promote keeps the project dirty.
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
   * Creates a server project from an arbitrary project's current circuit. Pure
   * transport, touching no metadata store, preview or dirty state, so it is
   * safe for a throwaway project built from a stored record.
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
   * Shared transport core behind create-from-draft, promote and
   * throwaway-upload; a create carries its document, so it is one round trip.
   *
   * `opts.attribution` is how fork lineage survives an upload: there is no
   * request field for it, the claim travels inside the document it describes,
   * and the server links `forkedFrom` from the chain's last entry.
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

  /** Deletes (unpublishes) a server library component. */
  deleteComponent(uuid: string): Observable<void> {
    return this.componentApi.delete(uuid);
  }

  /**
   * Name, symbol and description travel in placed snapshots, so the server
   * bumps `version` and re-stamps the edit time; both are emitted for the
   * registry to mirror, which is what offers older instances an update.
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
   * A rename is content the server stamps, so it bumps `version`; an open
   * project's metadata is synced so the next save presents the new one.
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

    // Shares are read-only: no dirty tracking, and no version — nothing here
    // ever presents one.
    this.metadataStore.register(
      project,
      {
        id: summary.id,
        name: summary.name,
        type,
        source: 'share',
        isPublic: summary.public,
        link: linkId,
        attribution: toMetadataAttribution(detail.attribution)
      },
      false
    );

    return { project, type };
  }

  /** One endpoint for both kinds: the link says what it points at. */
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
      // needs a session.
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

  /** Creates a server library master and an empty editor Project for it. */
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
   * Promotes a browser master to the server library, carrying the temp
   * project's circuit. Pure transport — the caller owns the registry/metadata
   * flip and removing the browser record — so a failed create leaves nothing
   * to unwind.
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
   * Loads a server library master into a fresh editor Project; the document
   * embeds every custom it places, so there are no extra fetches. Reuses the
   * master's session type id when already known.
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
   * Registers every cloud master into the registry at startup so they show in
   * the palette and resolve through the promotion alias map after a reload.
   *
   * The listing is bounded and carries no circuit bodies; a body is fetched
   * lazily on first placement or update
   * (see {@link PersistenceService.ensureServerMasterCircuit}). Best-effort: a
   * failing list call (unauthenticated or offline) just stops the walk.
   * Masters already known are left alone.
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
        // Usually unauthenticated or offline — no cloud library to preload.
        // Debug so a genuine failure stays traceable without nagging
        // signed-out users.
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
            // circuit omitted — fetched on demand
          },
          'server'
        );
      }

      loaded += result.entries.length;
      page++;
      // An empty page ends the walk whatever the count says: a component
      // deleted mid-walk would otherwise loop forever.
      if (result.entries.length === 0 || loaded >= result.total) return;
    }
  }

  /**
   * A server component's circuit body, for lazy hydration of a summary-only
   * master. Served from {@link _masterCircuitCache} after the first fetch.
   */
  async loadComponentCircuit(uuid: string): Promise<SerializedCircuitBody> {
    return (await this._fetchMasterCircuit(uuid)).body;
  }

  /**
   * The fetch-once primitive behind placement and edit-open: a cache hit skips
   * the GET and the re-ingest of the document's embedded snapshots.
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
   * Loads an already-registered server master from the shared circuit cache,
   * so placement and every edit-open share one GET. The summary comes from the
   * registry, the version from the cached fetch so saves keep their
   * concurrency check. Falls back to {@link loadComponent} when the master is
   * not registered — a deep link that outraced the preload.
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
   * Dropped on logout: the server masters leave the registry and their session
   * type ids retire, so a cached body would hold ids nothing can resolve.
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
   * Saves a custom-component editor as the native document, which embeds a
   * snapshot of every custom it places. The port surface is derived
   * server-side from that document: the plugs in the circuit are what a
   * component's ports *are*, so a client asserting them could only disagree
   * with the circuit it sent. Placed instances are frozen snapshots and do not
   * change; this affects future placements and explicit per-instance updates.
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

        // The next placement or edit-open must re-fetch the saved circuit
        // rather than serve the pre-save copy.
        this._masterCircuitCache.delete(metadata.id);

        this.metadataStore.updateVersion(project, summary.version);
        if (masterTypeId !== undefined) {
          this.registry.setMasterVersion(masterTypeId, summary.version);
          // Re-stamp the save time so the palette re-sorts this master up.
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
   * Branches on the API's own error code rather than the status: several
   * failures share a status, and the message is human-facing.
   *
   * `unauthorized` means the server session is gone underneath a still-true
   * auth cookie — flip to signed-out and ask for a fresh login; the unsaved
   * changes stay dirty.
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
   * Renders and uploads both theme thumbnails after a successful save.
   * Fire-and-forget: a failure is logged and swallowed rather than failing the
   * save. The parts are named for the theme each shows, so neither side
   * depends on their order.
   */
  private async _uploadPreview(
    project: Project,
    projectId: string
  ): Promise<void> {
    try {
      // Cosmetic — wait for an idle slice rather than stacking the generation
      // cost onto the frames doing the save's own UI work.
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
