import { inject, Injectable } from '@angular/core';
import { Location } from '@angular/common';
import { TranslationService } from '../translation/translation.service';
import { ToastService } from '../logging/toast.service';
import { LoggingService } from '../logging/logging.service';
import { Project } from '../project/project';
import { ProjectService } from '../project/project.service';
import { CircuitFileService } from './file/circuit-file.service';
import { BrowserProjectStore } from './browser/browser-project.store';
import { BrowserComponentStore } from './browser/browser-component.store';
import { ComponentIdMapStore } from './browser/component-id-map.store';
import { ProjectMetadataStore } from './project-metadata.store';
import { ServerPersistenceGateway } from './server/server-persistence.gateway';
import { CloudSessionService } from '../user/cloud-session.service';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import {
  CUSTOM_TYPE_ID_BASE,
  type FileForkAttributionV1,
  type SnapshotDefinition
} from '@logigator/core';
import { AuthRequiredError } from './persistence-errors';
import { buildProject } from './circuit-builder';
import { warnSkippedCustoms } from './load-warnings';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEvent } from '../analytics/analytics.mapping';

/**
 * One local custom component a circuit about to be uploaded embeds
 * transitively. `masterTypeId` is set for a registered browser master, which
 * can be promoted as its own library entry, and `null` for a dependency that
 * only survives as an embedded snapshot. Lists run children-before-parents, so
 * uploading in order lets every upload reference its promoted children.
 */
export interface LocalUploadDependency {
  name: string;
  masterTypeId: number | null;
}

/**
 * Moving documents from the browser store to the cloud: draft, project and
 * component promotion, plus the local-dependency queries behind the
 * upload-to-cloud dialog. Every upload here is a silent primitive;
 * `UploadCoordinatorService` sequences them children-first and reports the
 * outcome. See `docs/dependencies-and-promotion.md`.
 */
@Injectable({ providedIn: 'root' })
export class PromotionService {
  private readonly circuitFile = inject(CircuitFileService);
  private readonly browserStore = inject(BrowserProjectStore);
  private readonly browserComponentStore = inject(BrowserComponentStore);
  private readonly componentIdMapStore = inject(ComponentIdMapStore);
  private readonly registry = inject(CustomComponentRegistry);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly projectService = inject(ProjectService);
  private readonly server = inject(ServerPersistenceGateway);
  private readonly cloudSession = inject(CloudSessionService);
  private readonly toast = inject(ToastService);
  private readonly translation = inject(TranslationService);
  private readonly location = inject(Location);
  private readonly logging = inject(LoggingService);
  private readonly analytics = inject(AnalyticsService);

  /**
   * First save of a fresh draft to the server, creating the project record with
   * its circuit already in it.
   */
  async saveDraftAsServer(
    project: Project,
    name: string,
    isPublic: boolean
  ): Promise<void> {
    this._requireSignedIn();
    const id = await this.server.promoteToServer(project, name, isPublic);
    this.location.go(`/project/${id}`);
    this.analytics.capture(AnalyticsEvent.ProjectUploaded, {
      kind: 'project',
      isPublic
    });
  }

  /**
   * Uploads an already-saved local project to the cloud, keeping the live
   * project's circuit, undo history and embedded snapshots, then deletes the
   * browser record so the project moves rather than being copied. Rejects
   * anything but a stored browser project; a fresh draft saves as a draft.
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
    this._requireSignedIn();
    const oldId = metadata.id;

    // The only fail-able, irreversible step: until it returns nothing local
    // has changed and the upload can be retried.
    await this.server.promoteToServer(project, metadata.name, isPublic);
    this.location.go(`/project/${this.metadataStore.getMetadata(project)!.id}`);

    await this._dropBrowserProjectRecord(oldId);
    this.analytics.capture(AnalyticsEvent.ProjectUploaded, {
      kind: 'project',
      isPublic
    });
  }

  /**
   * Uploads a browser project by store id, which need not be the open one. The
   * open main project delegates to {@link promoteProjectToServer}, so unsaved
   * edits and the metadata flip are used; anything else uploads a throwaway
   * project built from the record, which is then deleted.
   */
  async uploadStoredProjectToServer(
    id: string,
    isPublic: boolean
  ): Promise<void> {
    this._requireSignedIn();
    const main = this.projectService.mainProject();
    if (main && this.metadataStore.getMetadata(main)?.id === id) {
      await this.promoteProjectToServer(main, isPublic);
      return;
    }

    const record = await this.browserStore.get(id);
    if (!record) throw new Error(`No browser project with id ${id}`);

    // The throwaway project exists only to be serialized. The stored blob's
    // fork attribution rides along so the server re-links the lineage.
    await this._withProjectFromContent(record.content, (temp, attribution) =>
      this.server.createServerProjectFromProject(
        temp,
        record.name,
        isPublic,
        attribution
      )
    );

    // Dropping the local record makes this a move, not a copy.
    await this._dropBrowserProjectRecord(id);
    this.analytics.capture(AnalyticsEvent.ProjectUploaded, {
      kind: 'project',
      isPublic
    });
  }

  /**
   * Moves a browser master to the server library: create the record with its
   * circuit, flip the registry to the new server id keeping the old one as a
   * persisted alias, then remove the browser record. The master keeps its
   * session type id, so placed instances and the palette tile survive. Rejects
   * a master that is not local or whose stored record is missing.
   */
  async promoteComponentToServer(
    masterTypeId: number,
    isPublic = false
  ): Promise<void> {
    const def = this.registry.getDefinition(masterTypeId);
    if (!def || def.kind !== 'master' || def.source !== 'browser' || !def.id) {
      throw new Error('Not a local component');
    }
    this._requireSignedIn();
    const oldId = def.id;
    const record = await this.browserComponentStore.get(oldId);
    if (!record) {
      throw new Error(`No browser component with id ${oldId}`);
    }

    // The only irreversible, fail-able step: on a throw the master is still
    // browser-sourced, the record intact and the upload retryable.
    const {
      id: newId,
      version,
      link: newLink,
      isPublic: newIsPublic
    } = await this._withProjectFromContent(record.content, (temp) =>
      this.server.promoteComponentFromProject(temp, {
        name: def.name,
        symbol: def.symbol,
        description: def.description,
        isPublic
      })
    );

    // Past the point of no return. The durable old→new alias and the record
    // delete land before the in-memory flip, so an interruption still leaves a
    // consistent reload. Neither may fail the operation — the upload already
    // succeeded — and a failure self-heals: the browser preload ignores a
    // record whose id has been promoted.
    try {
      await this.componentIdMapStore.put(oldId, newId);
      await this.browserComponentStore.delete(oldId);
    } catch {
      this.logging.warn(
        `Component ${oldId} uploaded to the cloud, but local cleanup failed`,
        'PromotionService'
      );
    }

    this.registry.promoteMaster(masterTypeId, newId, version, {
      link: newLink,
      isPublic: newIsPublic
    });
    this.analytics.capture(AnalyticsEvent.ProjectUploaded, {
      kind: 'component',
      isPublic
    });
    this.logging.info(
      `Promoted component ${oldId} -> ${newId} (v${version})`,
      'PromotionService'
    );
    this._reconcilePromotedEditor(oldId, newId, version);
  }

  /**
   * The local custom components a browser master embeds transitively, read
   * straight from its stored record: the closure is baked in at save time, so
   * no live project is built and no throwaway definition enters the registry.
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
   * {@link localDependencies} for a live project, walked over the registry
   * definitions of the placed snapshots so unsaved edits are reflected.
   */
  localDependenciesOfProject(project: Project): LocalUploadDependency[] {
    const entries: { name: string; sourceId?: string }[] = [];
    const visited = new Set<number>();
    // Post-order DFS emits a definition only after everything it places, which
    // is the children-before-parents upload order.
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
   * {@link localDependencies} for a stored browser project. The open main
   * project is walked live instead, matching what
   * {@link uploadStoredProjectToServer} uploads. Rejects if no record exists.
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
   * Orders embedded file definitions children-before-parents by a post-order
   * DFS over their file-local type references. `peekDefinitions` yields them
   * ancestors-first, and reversing that is not a valid topological order once a
   * dependency is shared, so the graph is walked explicitly.
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
   * Classifies already-ordered embedded definitions into
   * {@link LocalUploadDependency}s, preserving that order. Server-sourced
   * entries drop out — resolution goes through the promotion alias, so a
   * dependency uploaded earlier is skipped even when the document still
   * references its old id — and several snapshots of one master count as one
   * dependency, the deepest occurrence winning.
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
   * Re-points an open editor tab, matched by the old browser id, at the new
   * server identity, so saving it routes to the server rather than
   * resurrecting the deleted browser record.
   */
  private _reconcilePromotedEditor(
    oldId: string,
    newId: string,
    version: number
  ): void {
    const handle = this.metadataStore.getHandleById(oldId);
    if (
      handle?.metadata.type === 'comp' &&
      handle.metadata.source === 'browser'
    ) {
      this.metadataStore.update(handle.project, {
        source: 'server',
        id: newId,
        version
      });
    }
  }

  /**
   * Rejects creating a new cloud record while signed out — the proactive
   * counterpart to the API's 401. The marker error reads as already surfaced.
   */
  private _requireSignedIn(): void {
    if (this.cloudSession.isSignedIn()) return;
    this.toast.error(
      this.translation.translate('session.saveLoggedOut'),
      'PromotionService'
    );
    throw new AuthRequiredError();
  }

  /**
   * Builds a throwaway project from stored circuit JSON, runs `fn` on it and
   * always tears it down. `fn` also receives the blob's fork attribution: a
   * throwaway project has no metadata entry to carry it.
   */
  private async _withProjectFromContent<T>(
    content: string,
    fn: (project: Project, attribution?: FileForkAttributionV1[]) => Promise<T>
  ): Promise<T> {
    const { attribution, components, wires, skippedCustom } =
      this.circuitFile.fromJson(content);
    warnSkippedCustoms(
      this.toast,
      this.translation,
      skippedCustom,
      'PromotionService'
    );
    const temp = buildProject(components, wires);
    try {
      return await fn(temp, attribution);
    } finally {
      temp.destroy();
    }
  }

  /**
   * Best-effort: the upload already committed, so a cleanup failure is logged
   * rather than surfaced.
   */
  private async _dropBrowserProjectRecord(id: string): Promise<void> {
    try {
      await this.browserStore.delete(id);
    } catch {
      this.logging.warn(
        `Project ${id} uploaded to the cloud, but local cleanup failed`,
        'PromotionService'
      );
    }
  }
}
