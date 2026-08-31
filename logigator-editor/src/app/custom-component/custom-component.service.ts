import { inject, Injectable } from '@angular/core';
import { Project } from '../project/project';
import { ProjectService } from '../project/project.service';
import { WorkModeService } from '../work-mode/work-mode.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { PersistenceService } from '../persistence/persistence.service';
import { buildProject, instantiateBody } from '../persistence/circuit-builder';
import { ComponentLibraryService } from './component-library.service';
import { PromotionService } from '../persistence/promotion.service';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { CustomComponentDetails } from '@logigator/core';
import { ComponentProviderService } from '../components/component-provider.service';
import { CustomComponent } from '../components/custom/custom-component';
import { Action } from '../actions/action';
import { ActionContainer } from '../actions/action-container';
import { UpdateInstanceAction } from '../actions/actions/update-instance.action';
import { ToastService } from '../logging/toast.service';
import { TranslationService } from '../translation/translation.service';
import { firstValueFrom } from 'rxjs';
import { DialogService } from '@logigator/ui';
import { DefinitionBinding } from './definition-binding';
import { WireRepairService } from '../project/wire-repair.service';
import { UploadCoordinatorService } from '../ui/upload/upload-coordinator.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEvent, DialogId } from '../analytics/analytics.mapping';
import {
  CloseTabChoice,
  CloseTabDialogComponent
} from '../ui/dialogs/close-tab-dialog/close-tab-dialog.component';

export interface NewComponentMeta {
  name: string;
  symbol: string;
  description: string;
  isPublic?: boolean;
  /** Which library the new master lives in. Chosen by the user in the dialog. */
  source: 'server' | 'browser';
}

/**
 * Editor-side orchestration of custom components: create / open / close a
 * component editor tab, distinct from the rendering/registry layer. An editor
 * is a {@link Project} registered with `type: 'comp'`, carrying a
 * {@link DefinitionBinding} that keeps its master's summary current.
 */
@Injectable({ providedIn: 'root' })
export class CustomComponentService {
  private readonly registry = inject(CustomComponentRegistry);
  private readonly provider = inject(ComponentProviderService);
  private readonly projectService = inject(ProjectService);
  private readonly workModeService = inject(WorkModeService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly persistence = inject(PersistenceService);
  private readonly componentLibrary = inject(ComponentLibraryService);
  private readonly promotion = inject(PromotionService);
  private readonly uploadCoordinator = inject(UploadCoordinatorService);
  private readonly dialogService = inject(DialogService);
  private readonly analytics = inject(AnalyticsService);
  private readonly wireRepair = inject(WireRepairService);
  private readonly toast = inject(ToastService);
  private readonly translation = inject(TranslationService);

  private readonly _bindings = new Map<Project, DefinitionBinding>();
  // Snapshot type id -> its open read-only view tab, so viewing the same
  // embedded custom twice focuses one tab instead of opening a second copy.
  private readonly _snapshotViews = new Map<number, Project>();

  /**
   * Creates a new editable master and opens an empty editor tab for it. A
   * `'server'` master is created through the API, a `'browser'` one locally.
   */
  public async createComponent(meta: NewComponentMeta): Promise<Project> {
    if (meta.source === 'server') {
      try {
        const { project, masterTypeId } =
          await this.persistence.createServerComponent(meta);
        this._openEditor(project, masterTypeId);
        this.analytics.capture(AnalyticsEvent.CustomComponentCreated, {
          source: meta.source
        });
        return project;
      } catch (e) {
        this.toast.error(
          this.translation.translate('componentActions.createFailed'),
          'CustomComponentService',
          e
        );
        throw e;
      }
    }

    const masterTypeId = this.registry.createMaster(
      {
        name: meta.name,
        symbol: meta.symbol,
        description: meta.description
      },
      'browser'
    );
    const id = this.registry.idForTypeId(masterTypeId)!;

    const project = new Project();
    this.metadataStore.register(project, {
      id,
      name: meta.name,
      type: 'comp',
      source: 'browser',
      isPublic: meta.isPublic ?? false
    });

    this.metadataStore.markDirty(project);
    await this.persistence.saveProject(project);

    this._openEditor(project, masterTypeId);
    this.analytics.capture(AnalyticsEvent.CustomComponentCreated, {
      source: meta.source
    });
    return project;
  }

  /**
   * Brings a master's editor to the front, re-focusing an open one or loading
   * the circuit from whichever library the master belongs to. A reused master
   * shares its session type id, so palette tile and editor stay one definition.
   */
  public async openComponentForEdit(masterId: string): Promise<void> {
    // A placed instance's frozen snapshot id predates a later promotion, so
    // resolve it through the alias: the match and the load both need the id the
    // store or API knows, or the GET 404s until a reload.
    const id = this.registry.currentIdForId(masterId);
    const open = this._findOpenEditor(id);
    if (open) {
      this.projectService.setActiveProject(open);
      this._disarmPlacementFor(id);
      return;
    }
    try {
      const { project, masterTypeId } =
        this._sourceForMaster(id) === 'server'
          ? await this.persistence.loadServerComponentForEdit(id)
          : await this.persistence.loadComponentForEdit(id);
      this._openEditor(project, masterTypeId);
      this._disarmPlacementFor(id);
    } catch (err) {
      this.toast.error(
        this.translation.translate('componentActions.openFailed'),
        'CustomComponentService',
        err
      );
    }
  }

  /**
   * Recovers an orphaned placed custom — no master in any library, but its
   * circuit still embedded — into the browser library at the frozen version,
   * then opens it. Every instance that referenced it re-links to the new
   * master. No-op for a type that is not a restorable orphan.
   */
  public async restoreOrphanAndEdit(typeId: number): Promise<void> {
    // Captured before `openComponentForEdit` switches the active tab, which
    // would otherwise mark the wrong project.
    const host = this.projectService.activeProject();
    let masterId: string | null;
    // Stays undefined when the restore returned null rather than threw.
    let restoreError: unknown;
    try {
      masterId = await this.componentLibrary.restoreOrphanToLibrary(typeId);
    } catch (err) {
      masterId = null;
      restoreError = err;
    }
    if (!masterId) {
      this.toast.error(
        this.translation.translate('componentActions.restoreFailed'),
        'CustomComponentService',
        restoreError
      );
      return;
    }
    // The relink changed the host's serialized content without running an
    // Action, so nothing marked it dirty; without this flag the follow-up save
    // no-ops and a reload shows the component embedded again.
    if (host) this.metadataStore.markDirty(host);
    this.toast.success(
      this.translation.translate('componentActions.restored'),
      'CustomComponentService'
    );
    await this.openComponentForEdit(masterId);
  }

  /**
   * Opens an embedded custom's frozen circuit in a read-only tab, adding
   * nothing to the library. This is how a borrowed document is looked inside:
   * the viewer reads the circuit, and drills into nested customs, without
   * keeping a copy of a stranger's component.
   *
   * The tab registers as a `'share'` document, so every read-only suppression
   * applies unchanged. It carries no {@link DefinitionBinding} — there is no
   * master to keep in sync — and no store id, so closing it just disposes it.
   * No-op for a type id that is not an embedded snapshot.
   */
  public viewSnapshot(typeId: number): void {
    const def = this.registry.getDefinition(typeId);
    if (!def || def.kind !== 'snapshot') return;

    const open = this._snapshotViews.get(typeId);
    if (open) {
      this.projectService.setActiveProject(open);
      return;
    }

    const { components, wires } = instantiateBody(
      this.provider,
      def.circuit ?? { components: [], wires: [] }
    );
    const project = buildProject(components, wires);
    this.metadataStore.register(
      project,
      {
        id: '',
        name: def.name,
        type: 'comp',
        source: 'share',
        isPublic: false
      },
      false
    );
    this._snapshotViews.set(typeId, project);
    this.projectService.addOpenComponent(project);
    this.projectService.setActiveProject(project);
  }

  /**
   * Deletes a custom component from the library. The persistent record goes
   * first, so a failure aborts with nothing changed and stays retryable; then
   * the editor tab is force-closed, an armed placement disarmed and the master
   * dropped from the registry. Placed instances are frozen snapshots, so they
   * keep rendering and simply read as embedded copies, in every open project —
   * their provenance is unchanged, so none is marked dirty. No-op for a type id
   * that is not a library master.
   */
  public async deleteComponent(masterTypeId: number): Promise<void> {
    const def = this.registry.getDefinition(masterTypeId);
    if (!def || def.kind !== 'master') return;

    try {
      await this.componentLibrary.deletePersistentMaster(def);
    } catch (err) {
      this.toast.error(
        this.translation.translate('deleteComponent.deleteFailed'),
        'CustomComponentService',
        err
      );
      return;
    }

    // Close the editor tab before dropping the def its binding writes into.
    if (def.id !== undefined) {
      const open = this._findOpenEditor(this.registry.currentIdForId(def.id));
      if (open) this.forceCloseComponent(open);
    }
    // The palette tile is gone, so a placement still pointed at it must go.
    if (this.workModeService.selectedComponentType() === masterTypeId) {
      this.workModeService.setMode(WorkMode.PAN);
    }
    this.registry.removeMaster(masterTypeId);

    this.analytics.capture(AnalyticsEvent.CustomComponentDeleted, {
      source: def.source
    });

    this.toast.success(
      this.translation.translate('deleteComponent.deleted', { name: def.name }),
      'CustomComponentService'
    );
  }

  /**
   * Updates a master's name/symbol/description. The persistent record is
   * written first, so a failure aborts with nothing changed and stays
   * retryable; then the session master is patched in place and adopts the
   * persisted `version` bump. The details travel in placed snapshots, so
   * instances frozen at the older version are offered "Update to latest" and
   * stay frozen until then. No-op for a type id that is not a library master.
   */
  public async updateComponentDetails(
    masterTypeId: number,
    details: CustomComponentDetails
  ): Promise<void> {
    const def = this.registry.getDefinition(masterTypeId);
    if (!def || def.kind !== 'master') return;

    let stamps: { version?: number; lastEdited?: number };
    try {
      stamps = await this.componentLibrary.updatePersistentMasterDetails(
        def,
        details
      );
    } catch (err) {
      this.toast.error(
        this.translation.translate('editComponentDetails.saveFailed'),
        'CustomComponentService',
        err
      );
      return;
    }

    this.registry.updateDefinition(masterTypeId, {
      numInputs: def.numInputs,
      numOutputs: def.numOutputs,
      labels: def.labels,
      ...details
    });
    // Without a persisted stamp the master version stays put, so placed
    // instances are not spuriously flagged stale.
    if (stamps.version !== undefined) {
      this.registry.setMasterVersion(masterTypeId, stamps.version);
    }
    // Also bumps the registry revision, so the palette re-sorts and signal
    // readers re-resolve the name.
    this.registry.setMasterLastEdited(masterTypeId, stamps.lastEdited);

    if (def.id !== undefined) {
      const open = this._findOpenEditor(this.registry.currentIdForId(def.id));
      if (open) this.metadataStore.update(open, { name: details.name });
    }

    this.toast.success(
      this.translation.translate('editComponentDetails.saved'),
      'CustomComponentService'
    );
  }

  /**
   * Drops back to the pan tool when a placement is armed for the master just
   * opened for editing: opening an editor from the palette ghost should leave
   * the ghost deselected.
   */
  private _disarmPlacementFor(masterId: string): void {
    const typeId = this.registry.masterTypeIdForId(masterId);
    if (
      typeId !== undefined &&
      this.workModeService.selectedComponentType() === typeId
    ) {
      this.workModeService.setMode(WorkMode.PAN);
    }
  }

  /** Adds the editor as a tab, focuses it, and attaches its definition binding. */
  private _openEditor(project: Project, masterTypeId: number): void {
    this.projectService.addOpenComponent(project);
    this.projectService.setActiveProject(project);
    this._bindings.set(
      project,
      new DefinitionBinding(project, masterTypeId, this.registry)
    );
    // A master's circuit can carry the same wire corruption as a project's.
    this.wireRepair.offerRepairOnLoad(project);
  }

  /** The library a registered master belongs to; defaults to browser if unknown. */
  private _sourceForMaster(masterId: string): 'server' | 'browser' {
    const typeId = this.registry.masterTypeIdForId(masterId);
    const def =
      typeId !== undefined ? this.registry.getDefinition(typeId) : undefined;
    return def?.source === 'server' ? 'server' : 'browser';
  }

  /**
   * Closes a component editor tab. A clean editor is disposed straight away, a
   * dirty one prompts Save / Discard / Cancel first, and a dismissal counts as
   * cancel so work is never lost by accident. A failed save keeps the tab open.
   */
  public async closeComponent(project: Project): Promise<void> {
    if (!this.metadataStore.isDirty(project)) {
      this._disposeEditor(project);
      return;
    }

    const choice = await this._promptClose(project);
    if (choice === 'discard') {
      this._disposeEditor(project);
    } else if (choice === 'save') {
      if (await this.uploadCoordinator.promoteLocalDepsAndSave(project)) {
        this._disposeEditor(project);
      }
      // A failed save is already toasted; keep the tab open for a retry.
    }
  }

  /**
   * Closes a component editor tab with no prompting, for flows that have
   * already resolved the dirty question themselves.
   */
  public forceCloseComponent(project: Project): void {
    this._disposeEditor(project);
  }

  /**
   * Opens the close-confirmation dialog for a dirty editor, folding in the
   * warning that saving a cloud document publishes its local dependencies.
   * Resolves `undefined` when the dialog is dismissed.
   */
  private _promptClose(project: Project): Promise<CloseTabChoice | undefined> {
    const metadata = this.metadataStore.getMetadata(project);
    const localDepCount =
      metadata?.source === 'server'
        ? this.promotion
            .localDependenciesOfProject(project)
            .filter((d) => d.masterTypeId !== null).length
        : 0;

    const ref = this.dialogService.open(CloseTabDialogComponent, {
      header: this.translation.translate('closeTab.header'),
      width: '28rem',
      modal: true,
      closable: true,
      telemetryId: DialogId.CloseTab,
      data: {
        name: metadata?.name ?? this.translation.translate('common.untitled'),
        promotionWarning:
          localDepCount > 0
            ? this.translation.translate('closeTab.promotionWarning', {
                count: localDepCount
              })
            : undefined
      }
    });
    if (!ref) return Promise.resolve(undefined);
    return firstValueFrom(ref.onClose);
  }

  private _disposeEditor(project: Project): void {
    this._bindings.get(project)?.dispose();
    this._bindings.delete(project);
    for (const [typeId, view] of this._snapshotViews) {
      if (view === project) this._snapshotViews.delete(typeId);
    }
    this.projectService.removeOpenComponent(project);
    this.metadataStore.remove(project);
    project.destroy();
  }

  /**
   * Brings one placed instance up to its master's current state: re-snapshot
   * the master, then replace the instance with one of the new snapshot type at
   * the same position and direction. Null when the master no longer resolves —
   * there is nothing to update against, and the instance keeps working.
   */
  public buildInstanceUpdate(instance: CustomComponent): Action | null {
    const def = this.registry.getDefinition(instance.config.type);
    if (def?.id === undefined) return null;
    const masterTypeId = this.registry.masterTypeIdForId(def.id);
    if (masterTypeId === undefined) return null;

    const newDef = this.registry.snapshot(masterTypeId);
    const config = this.provider.getComponent(newDef.typeId);
    if (!config) return null;

    const replacement = config.create({});
    replacement.direction = instance.direction;
    replacement.position.copyFrom(instance.position);

    const action = new UpdateInstanceAction(instance, replacement);
    // Only built to be serialized into the action, which creates the real
    // instance on do().
    replacement.destroy({ children: true });
    return action;
  }

  /**
   * Groups per-instance updates into one undo entry. The registry caches a
   * master's snapshot, so every replacement lands on one shared new type id and
   * the save file holds one definition. Null when no instance yields an update.
   */
  public buildInstancesUpdate(
    instances: readonly CustomComponent[]
  ): Action | null {
    const actions = instances
      .map((instance) => this.buildInstanceUpdate(instance))
      .filter((action): action is Action => action !== null);
    return actions.length > 0 ? new ActionContainer(...actions) : null;
  }

  /**
   * Ensures a master's circuit is loaded before it is placed or updated: cloud
   * masters are preloaded summary-only. No-op for built-ins, browser masters
   * and loaded ones. `false` means a failed fetch, so the caller aborts instead
   * of working against empty content.
   */
  public async ensureMasterCircuit(masterTypeId: number): Promise<boolean> {
    try {
      await this.componentLibrary.ensureServerMasterCircuit(masterTypeId);
      return true;
    } catch (err) {
      this.toast.error(
        this.translation.translate('componentActions.cloudLoadFailed'),
        'CustomComponentService',
        err
      );
      return false;
    }
  }

  private _findOpenEditor(masterId: string): Project | undefined {
    for (const project of this.projectService.openComponents()) {
      if (this.metadataStore.getMetadata(project)?.id === masterId) {
        return project;
      }
    }
    return undefined;
  }
}
