import { Injectable, inject } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
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
import { Page } from '../../api/models/shared';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { ComponentProviderService } from '../../components/component-provider.service';
import { deriveSummary } from '../../custom-component/definition-derivation';
import { buildProject } from '../circuit-builder';
import { AuthRequiredError, formatHttpError } from '../persistence-errors';

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
        elements
      })
    );
    this.metadataStore.updateHash(
      project,
      saveResponse.elementsFile?.hash ?? ''
    );

    return { project, id: response.id };
  }

  listProjects(
    page?: number,
    search?: string
  ): Observable<Page<ProjectSummary>> {
    return this.projectApi.list(page ?? 1, 5, search);
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
      this.logging.error(
        `Cannot clone share ${linkId}: user not authenticated`,
        'PersistenceService'
      );
      this.toast.error(`Cannot clone share ${linkId}: user not authenticated`);
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

    const summary = deriveSummary(project);
    const { elements, dependencies } = server.serializeProject(
      project,
      this.registry,
      this.provider
    );
    try {
      const saveResponse = await firstValueFrom(
        this.componentApi.save(response.id, {
          oldHash: response.elementsFile?.hash ?? '',
          dependencies,
          elements,
          numInputs: summary.numInputs,
          numOutputs: summary.numOutputs,
          labels: summary.labels
        })
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
      server.toCircuitFileV0({
        name: detail.name,
        elements: detail.elements,
        dependencies: detail.dependencies
      })
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
          elements
        })
      );

      this.metadataStore.updateHash(project, response.elementsFile?.hash ?? '');
      if (this.metadataStore.dirtyVersion(project) === versionAtSnapshot) {
        this.metadataStore.clearDirty(project);
      }
      this.toast.success('Project saved');
    } catch (err) {
      if (this._isVersionMismatch(err)) {
        this.logging.error(
          'Version mismatch — reload required',
          'PersistenceService'
        );
        this.toast.error('Version mismatch — reload required');
      } else {
        this.logging.error(
          `Save failed: ${formatHttpError(err)}`,
          'PersistenceService'
        );
        this.toast.error(`Save failed: ${formatHttpError(err)}`);
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
    const summary = deriveSummary(project);
    const { elements, dependencies } = server.serializeProject(
      project,
      this.registry,
      this.provider
    );

    try {
      const response = await firstValueFrom(
        this.componentApi.save(metadata.id, {
          oldHash: metadata.hash,
          dependencies,
          elements,
          numInputs: summary.numInputs,
          numOutputs: summary.numOutputs,
          labels: summary.labels
        })
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
      this.toast.success('Component saved');
    } catch (err) {
      if (this._isVersionMismatch(err)) {
        this.logging.error(
          'Version mismatch — reload required',
          'PersistenceService'
        );
        this.toast.error('Version mismatch — reload required');
      } else {
        this.logging.error(
          `Save failed: ${formatHttpError(err)}`,
          'PersistenceService'
        );
        this.toast.error(`Save failed: ${formatHttpError(err)}`);
      }
      throw err;
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
