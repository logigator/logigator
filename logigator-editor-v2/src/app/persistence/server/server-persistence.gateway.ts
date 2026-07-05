import { inject, Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
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
import { buildProject } from '../circuit-builder';
import type { SerializedCircuitBody } from '../serialized-circuit';
import { AuthRequiredError, formatHttpError } from '../persistence-errors';
import { BoardSnapshotService } from '../../rendering/board-snapshot.service';

/**
 * Server transport + codec + metadata + build, returning `Project`s. Owns every
 * method coupled to the legacy positional API; the facade keeps main-slot
 * orchestration, navigation and dirty-dispatch. Deleted wholesale when the
 * native-model API ships (see CLAUDE.md).
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
  private readonly transloco = inject(TranslocoService);
  private readonly snapshot = inject(BoardSnapshotService);

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
        this.transloco.translate('persistence.legacyProjectWarning')
      );
    }

    return project;
  }

  async createProject(
    name: string,
    description?: string,
    isPublic?: boolean
  ): Promise<{ project: Project; id: string }> {
    const response = await firstValueFrom(
      this.projectApi.create({
        name,
        description,
        public: isPublic ? 'true' : 'false'
      })
    );

    const project = new Project();
    this.metadataStore.register(project, {
      id: response.id,
      name,
      type: 'project',
      source: 'server',
      hash: response.elementsFile?.hash ?? '',
      isPublic: isPublic ?? false
    });

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
    this.metadataStore.updateHash(
      project,
      saveResponse.elementsFile?.hash ?? ''
    );

    return { project, id: response.id };
  }

  /**
   * Promotes a fresh in-memory draft to a **server** project without discarding
   * its circuit or undo history: POSTs `/api/project` to create the record,
   * flips the project's metadata to `source:'server'`, then PUTs its current
   * content. Mirrors {@link createProject}, but operates on the live project
   * instead of a fresh empty one. Returns the new server id. The dirty-version
   * snapshot guard matches {@link saveProject}: an edit landing mid-promote
   * keeps the project dirty.
   */
  async promoteToServer(
    project: Project,
    name: string,
    isPublic: boolean
  ): Promise<string> {
    const versionAtSnapshot = this.metadataStore.dirtyVersion(project);
    const response = await firstValueFrom(
      this.projectApi.create({
        name,
        public: isPublic ? 'true' : 'false'
      })
    );

    this.metadataStore.update(project, {
      source: 'server',
      id: response.id,
      name,
      isPublic,
      hash: response.elementsFile?.hash ?? ''
    });

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
    this.metadataStore.updateHash(
      project,
      saveResponse.elementsFile?.hash ?? ''
    );
    if (this.metadataStore.dirtyVersion(project) === versionAtSnapshot) {
      this.metadataStore.clearDirty(project);
    }
    this.toast.success('Project saved');
    void this._uploadPreview(project, response.id);
    return response.id;
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
        this.transloco.translate('persistence.shareAuthRequired'),
        `Cannot clone share ${linkId}: user not authenticated`,
        'ServerPersistenceGateway'
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
        description: meta.description
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
  ): Promise<{ id: string; version: number; hash: string }> {
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
      hash: saveResponse.elementsFile?.hash ?? ''
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
          labels: detail.labels
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
          labels: summary.labels
          // circuit omitted — loaded on demand by ensureServerMasterCircuit
        },
        'server'
      );
    }
  }

  /**
   * Fetches a server component's circuit body (GET `/api/component/:id`) for lazy
   * hydration of a summary-only master. Used the first time a preloaded cloud
   * master is placed or updated.
   */
  async loadComponentCircuit(uuid: string): Promise<SerializedCircuitBody> {
    const detail = await firstValueFrom(this.componentApi.open(uuid));
    return this.circuitFile.decodeToBodyFromData(
      this._componentDetailToV0(detail)
    );
  }

  async saveProject(project: Project): Promise<void> {
    // Capture metadata and a dirty version snapshot *before* serializing.
    // If new edits land between snapshot and save completion, we must NOT
    // clear the dirty flag — otherwise the user sees "Saved" with unsaved
    // changes still in the editor.
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
      this.toast.success(this.transloco.translate('persistence.projectSaved'));
      void this._uploadPreview(project, metadata.id);
    } catch (err) {
      if (this._isVersionMismatch(err)) {
        this.toast.error(
          this.transloco.translate('persistence.versionMismatch'),
          err,
          'ServerPersistenceGateway'
        );
      } else {
        this.toast.error(
          this.transloco.translate('persistence.saveFailed', {
            detail: formatHttpError(err)
          }),
          err,
          'ServerPersistenceGateway'
        );
      }
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

      this.metadataStore.updateHash(project, response.elementsFile?.hash ?? '');
      // Adopt the server's save-time version stamp; without it (e.g. a backend
      // that does not yet implement the additive change) the master version is
      // left unchanged, so placed instances are not spuriously flagged stale.
      if (response.version !== undefined && masterTypeId !== undefined) {
        this.registry.setMasterVersion(masterTypeId, response.version);
      }
      if (this.metadataStore.dirtyVersion(project) === versionAtSnapshot) {
        this.metadataStore.clearDirty(project);
      }
      this.toast.success(
        this.transloco.translate('persistence.componentSaved')
      );
    } catch (err) {
      if (this._isVersionMismatch(err)) {
        this.toast.error(
          this.transloco.translate('persistence.versionMismatch'),
          err,
          'ServerPersistenceGateway'
        );
      } else {
        this.toast.error(
          this.transloco.translate('persistence.saveFailed', {
            detail: formatHttpError(err)
          }),
          err,
          'ServerPersistenceGateway'
        );
      }
      throw err;
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
