import { inject, Injectable } from '@angular/core';
import { TranslationService } from '../../translation/translation.service';
import { firstValueFrom, map, Observable, tap } from 'rxjs';
import { ProjectApiService } from '../../api/services/project-api.service';
import { ComponentApiService } from '../../api/services/component-api.service';
import { ShareApiService } from '../../api/services/share-api.service';
import { CircuitFileService } from '../file/circuit-file.service';
import { ProjectMetadataStore } from '../project-metadata.store';
import { ToastService } from '../../logging/toast.service';
import { LoggingService } from '../../logging/logging.service';
import { Project } from '../../project/project';
import {
  isApiError,
  type DocumentVisibility,
  type ProjectPage,
  type ProjectSummary
} from '@logigator/contract';
import type { LgDocumentKind } from '@logigator/ui';
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

/**
 * What a preview publish sends: both theme renders, or `empty` for a circuit
 * with nothing on it.
 */
type PreviewRender = { dark: Blob; light: Blob } | 'empty';

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

  /**
   * One publish chain per document, so the render asked for last is the one
   * written last; two saves' uploads racing could leave the older picture.
   */
  private readonly _previewChains = new Map<string, Promise<void>>();

  /**
   * Whether the server holds a preview for a document, as far as this session
   * has seen: what the API reported on create, open and the library preload,
   * and what this client wrote since. Opening one known to lack a preview
   * draws it (see {@link _healPreview}); a document not in the map is left
   * alone either way.
   */
  private readonly _hasPreview = new Map<string, boolean>();

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
      visibility: detail.visibility,
      link: detail.link,
      attribution: toMetadataAttribution(detail.attribution)
    });
    this._hasPreview.set(uuid, detail.preview !== null);
    this._healPreview('project', uuid, project);

    return project;
  }

  /**
   * An absent visibility is left absent: the API's own default for one is
   * `unlisted`, a link that resolves and is in no listing.
   */
  async createProject(
    name: string,
    description?: string,
    visibility?: DocumentVisibility
  ): Promise<{ project: Project; id: string }> {
    const project = new Project();
    const summary = await firstValueFrom(
      this.projectApi.create({ name, description, visibility })
    );
    this._hasPreview.set(summary.id, false);
    this.metadataStore.register(project, {
      id: summary.id,
      name,
      type: 'project',
      source: 'server',
      version: summary.version,
      visibility: summary.visibility,
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
    visibility: DocumentVisibility
  ): Promise<string> {
    const attribution = this.metadataStore.getMetadata(project)?.attribution;
    const id = await this.metadataStore.withDirtyGuard(project, async () => {
      const summary = await this._createServerProject(
        project,
        name,
        visibility,
        { attribution }
      );

      this.metadataStore.update(project, {
        source: 'server',
        id: summary.id,
        name,
        visibility: summary.visibility,
        version: summary.version,
        link: summary.link
      });
      return summary.id;
    });
    this._refreshPreview('project', id, project);
    return id;
  }

  /**
   * Creates a server project from an arbitrary project's current circuit,
   * touching no metadata store or dirty state, so it is safe for a throwaway
   * project built from a stored record. The preview is rendered before this
   * resolves, so the caller may tear the project down straight after.
   */
  async createServerProjectFromProject(
    project: Project,
    name: string,
    visibility: DocumentVisibility,
    attribution?: FileForkAttributionV1[]
  ): Promise<string> {
    const summary = await this._createServerProject(project, name, visibility, {
      attribution
    });
    this._publishPreviewOf('project', summary.id, project);
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
  private async _createServerProject(
    project: Project,
    name: string,
    visibility: DocumentVisibility,
    opts?: { description?: string; attribution?: FileForkAttributionV1[] }
  ): Promise<ProjectSummary> {
    const { file } = this.circuitFile.toDocument(
      project,
      name,
      opts?.attribution
    );
    const summary = await firstValueFrom(
      this.projectApi.create({
        name,
        description: opts?.description,
        visibility,
        document: file
      })
    );
    this._hasPreview.set(summary.id, false);
    return summary;
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

  /**
   * The kind is the API's, and part of the address: the link is the document's
   * capability in one of two tables, not a key that names its own.
   */
  async loadShare(
    kind: LgDocumentKind,
    linkId: string
  ): Promise<{ project: Project; type: 'project' | 'comp' }> {
    const detail = await firstValueFrom(this.shareApi.read(kind, linkId));
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
        visibility: summary.visibility,
        link: linkId,
        attribution: toMetadataAttribution(detail.attribution)
      },
      false
    );

    return { project, type };
  }

  /** One endpoint per kind: the link alone does not say which table it is in. */
  async cloneFromShare(
    kind: LgDocumentKind,
    linkId: string
  ): Promise<{ id: string; type: 'project' | 'comp' }> {
    try {
      const response = await firstValueFrom(this.shareApi.clone(kind, linkId));
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
    visibility?: DocumentVisibility;
  }): Promise<{ project: Project; masterTypeId: number }> {
    const summary = await firstValueFrom(
      this.componentApi.create({
        name: meta.name,
        symbol: meta.symbol,
        description: meta.description,
        visibility: meta.visibility
      })
    );
    this._hasPreview.set(summary.id, false);

    const project = new Project();
    const masterTypeId = this.registry.createMaster(
      {
        id: summary.id,
        version: summary.version,
        name: meta.name,
        symbol: meta.symbol,
        description: meta.description,
        link: summary.link,
        visibility: summary.visibility
      },
      'server'
    );
    this.metadataStore.register(project, {
      id: summary.id,
      name: meta.name,
      type: 'comp',
      source: 'server',
      version: summary.version,
      visibility: summary.visibility
    });

    return { project, masterTypeId };
  }

  /**
   * Promotes a browser master to the server library, carrying the temp
   * project's circuit. Transport and its preview only — the caller owns the
   * registry/metadata flip and removing the browser record — so a failed
   * create leaves nothing to unwind. The preview is rendered before this
   * resolves, so the caller may tear the project down straight after.
   */
  async promoteComponentFromProject(
    project: Project,
    meta: {
      name: string;
      symbol: string;
      description: string;
      visibility?: DocumentVisibility;
    }
  ): Promise<{
    id: string;
    version: number;
    link?: string;
    visibility: DocumentVisibility;
  }> {
    const { file } = this.circuitFile.toDocument(project, meta.name);
    const summary = await firstValueFrom(
      this.componentApi.create({
        name: meta.name,
        symbol: meta.symbol,
        description: meta.description,
        visibility: meta.visibility,
        document: file
      })
    );
    this._hasPreview.set(summary.id, false);
    this._publishPreviewOf('comp', summary.id, project);

    return {
      id: summary.id,
      version: summary.version,
      link: summary.link,
      visibility: summary.visibility
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
          visibility: detail.visibility,
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
      visibility: detail.visibility
    });
    this._hasPreview.set(uuid, detail.preview !== null);
    this._healPreview('comp', uuid, project);

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
        this._hasPreview.set(summary.id, summary.preview !== null);
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
            visibility: summary.visibility,
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
      visibility: def.visibility ?? 'private'
    });
    this._healPreview('comp', uuid, project);

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
    this._refreshPreview('project', metadata.id, project);
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
    this._refreshPreview('comp', metadata.id, project);
  }

  /**
   * Branches on the API's own error code rather than the status: several
   * failures share a status, and the message is human-facing.
   *
   * `unauthorized` means the server session is gone underneath a still-true
   * auth cookie — flip to signed-out and ask for a fresh login; the unsaved
   * changes stay dirty.
   *
   * `payload_too_large` is the request never reaching a handler: the circuit
   * is past the size the API accepts, which is about the board rather than
   * about this save, so the generic detail would say nothing.
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
    } else if (isApiError(err, 'payload_too_large')) {
      this.toast.error(
        this.translation.translate('persistence.saveTooLarge'),
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
   * Re-renders a live document's preview after a write. Cosmetic, so it waits
   * for an idle slice rather than stacking the generation cost onto the frames
   * doing the save's own UI work.
   */
  private _refreshPreview(
    kind: 'project' | 'comp',
    id: string,
    project: Project
  ): void {
    this._publishPreview(kind, id, async () => {
      await whenIdle(PREVIEW_IDLE_TIMEOUT_MS);
      return this._renderPreview(project);
    });
  }

  /**
   * For a project that only exists for the length of an upload: the scene is
   * read synchronously, here, so the caller's teardown cannot outrun it, and
   * only the readback and the upload are left to run on their own.
   */
  private _publishPreviewOf(
    kind: 'project' | 'comp',
    id: string,
    project: Project
  ): void {
    const rendered = this._renderPreview(project).catch((err: unknown) => {
      this._warnPreviewFailed(err);
      return null;
    });
    this._publishPreview(kind, id, () => rendered);
  }

  /**
   * Draws the preview of a document just opened when the server holds none.
   * That covers every way one can end up without a preview this client did not
   * see happen — a render or upload that failed, a clone of a document that had
   * none, a write made before every path uploaded one — since opening a
   * document the caller owns is where a renderer and its circuit first meet. A
   * deep link opens its document before the board has leased a renderer, so
   * this waits for one; the wait stays outside the chain so it cannot hold up
   * a save's own upload.
   */
  private _healPreview(
    kind: 'project' | 'comp',
    id: string,
    project: Project
  ): void {
    if (this._hasPreview.get(id) !== false) return;
    void this.snapshot.whenAvailable().then(() =>
      this._publishPreview(kind, id, async () => {
        // A save, or the same document opened twice, may already have drawn it.
        if (this._hasPreview.get(id) !== false) return null;
        await whenIdle(PREVIEW_IDLE_TIMEOUT_MS);
        return this._renderPreview(project);
      })
    );
  }

  /**
   * Appends one publish to the document's chain. Fire-and-forget: a failure
   * is logged and swallowed rather than failing the write it follows, and the
   * document is drawn again the next time it is saved or opened.
   */
  private _publishPreview(
    kind: 'project' | 'comp',
    id: string,
    render: () => Promise<PreviewRender | null>
  ): void {
    const previous = this._previewChains.get(id) ?? Promise.resolve();
    const next = previous.then(async () => {
      try {
        const rendered = await render();
        if (rendered) await this._sendPreview(kind, id, rendered);
      } catch (err) {
        this._warnPreviewFailed(err);
      }
    });
    this._previewChains.set(id, next);
    void next.then(() => {
      if (this._previewChains.get(id) === next) this._previewChains.delete(id);
    });
  }

  /**
   * The parts are named for the theme each shows, so neither side depends on
   * their order. An empty circuit clears the preview instead: saying there is
   * nothing to show is the placeholder's job, and a transparent render would
   * leave the tile a blank ground.
   */
  private async _sendPreview(
    kind: 'project' | 'comp',
    id: string,
    rendered: PreviewRender
  ): Promise<void> {
    if (rendered === 'empty') {
      if (this._hasPreview.get(id) !== true) return;
      await firstValueFrom(
        kind === 'project'
          ? this.projectApi.clearPreview(id)
          : this.componentApi.clearPreview(id)
      );
      this._hasPreview.set(id, false);
      return;
    }

    const formData = new FormData();
    formData.append('light', rendered.light, 'preview-light.png');
    formData.append('dark', rendered.dark, 'preview-dark.png');
    if (kind === 'project') {
      await firstValueFrom(this.projectApi.setPreview(id, formData));
    } else {
      await firstValueFrom(this.componentApi.setPreview(id, formData));
    }
    this._hasPreview.set(id, true);
  }

  /**
   * `null` where nothing can be drawn — no renderer yet, or the project was
   * closed before its turn came.
   */
  private async _renderPreview(
    project: Project
  ): Promise<PreviewRender | null> {
    if (project.destroyed) return null;
    if (project.isEmpty) return 'empty';
    return this.snapshot.generatePreviews(project);
  }

  private _warnPreviewFailed(err: unknown): void {
    this.logging.warn(
      `Preview upload failed: ${formatHttpError(err)}`,
      'ServerPersistenceGateway'
    );
  }
}
