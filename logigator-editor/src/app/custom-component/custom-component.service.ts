import { inject, Injectable } from '@angular/core';
import { Project } from '../project/project';
import { ProjectService } from '../project/project.service';
import { WorkModeService } from '../work-mode/work-mode.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { PersistenceService } from '../persistence/persistence.service';
import { ComponentLibraryService } from './component-library.service';
import { PromotionService } from '../persistence/promotion.service';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { ComponentProviderService } from '../components/component-provider.service';
import { CustomComponent } from '../components/custom/custom-component';
import { Action } from '../actions/action';
import { UpdateInstanceAction } from '../actions/actions/update-instance.action';
import { ToastService } from '../logging/toast.service';
import { TranslationService } from '../translation/translation.service';
import { firstValueFrom } from 'rxjs';
import { DialogService } from '@logigator/ui';
import { DefinitionBinding } from './definition-binding';
import { UploadCoordinatorService } from '../ui/upload/upload-coordinator.service';
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
 * component **editor** tab, distinct from the rendering/registry layer. A
 * component editor is just a {@link Project} registered with `type: 'comp'`,
 * carrying a {@link DefinitionBinding} that keeps its master's summary current.
 *
 * Masters live in the browser id space: creating opens an empty editor, opening
 * loads a saved master's circuit from the browser `components` store (or re-focuses
 * an already-open editor), and closing saves a dirty editor before disposing it.
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
  private readonly toast = inject(ToastService);
  private readonly translation = inject(TranslationService);

  private readonly _bindings = new Map<Project, DefinitionBinding>();

  /**
   * Creates a new editable master and opens an empty editor tab for it. The
   * user picks the store in the new-component dialog: a `'server'` master is
   * created via the API (POST), a `'browser'` master is minted locally.
   */
  public async createComponent(meta: NewComponentMeta): Promise<Project> {
    if (meta.source === 'server') {
      try {
        const { project, masterTypeId } =
          await this.persistence.createServerComponent(meta);
        this._openEditor(project, masterTypeId);
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
      hash: '',
      isPublic: meta.isPublic ?? false
    });

    this.metadataStore.markDirty(project);
    await this.persistence.saveProject(project);

    this._openEditor(project, masterTypeId);
    return project;
  }

  /**
   * Brings the editor for a master to the front, re-focusing an already-open
   * editor or loading the master's circuit (the universal embedded-snapshot
   * path) from whichever library the master belongs to — server (GET) or the
   * browser `components` store. A reused master shares its session type id, so
   * the palette tile and the editor stay one definition.
   */
  public async openComponentForEdit(masterId: string): Promise<void> {
    // The caller may pass a placed instance's frozen snapshot id, which — if the
    // master was promoted to the cloud after that snapshot was taken — is the
    // pre-promotion (browser) id. Resolve it to the master's current id through
    // the promotion alias so the open-editor match and the load both use the id
    // the store/API actually knows (otherwise the server GET 404s until reload).
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
   * Recovers an **orphaned** placed custom — one whose master is no longer in any
   * library, though its circuit is still embedded — by restoring it into the
   * browser library, then opening it for editing. Restores at the frozen version;
   * every instance that referenced it re-links to the new master. No-op if the
   * type is not a restorable orphan.
   */
  public async restoreOrphanAndEdit(typeId: number): Promise<void> {
    // The host project whose placed instance is being restored. Capture it now:
    // `openComponentForEdit` below switches the active tab to the new master's
    // editor, so reading it afterwards would mark the wrong project.
    const host = this.projectService.activeProject();
    let masterId: string | null;
    // Captured so the failure toast below can carry a stack; stays undefined
    // when the restore returned null (not a restorable orphan) rather than threw.
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
    // Restore relinked the placed snapshot's provenance in the registry, so the
    // host's serialized content changed — but no Action ran, so it was never
    // marked dirty. Flag it explicitly, else the follow-up save no-ops on the
    // dirty guard (after the dependency was already promoted) and a reload shows
    // the component embedded again.
    if (host) this.metadataStore.markDirty(host);
    this.toast.success(
      this.translation.translate('componentActions.restored'),
      'CustomComponentService'
    );
    await this.openComponentForEdit(masterId);
  }

  /**
   * Deletes a custom component from the library. The persistent record is removed
   * first (browser store, or the API for a cloud master — unpublishing it): if that
   * fails the delete aborts with nothing changed, so it stays retryable. On success
   * any open editor tab for the master is force-closed (its unsaved edits are moot —
   * the component is going away), a placement armed for it is disarmed, and the
   * master is dropped from the registry. Placed instances are frozen snapshots, so
   * they keep rendering; they simply stop resolving to a master and read as embedded
   * copies — across every open project, since the registry is session-wide. Their
   * embedded provenance is unchanged, so no open project is marked dirty. No-op for
   * a type id that is not a library master.
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
    // Disarm a placement still pointed at the master whose palette tile just
    // vanished (the settings-panel delete acts on the placement ghost).
    if (this.workModeService.selectedComponentType() === masterTypeId) {
      this.workModeService.setMode(WorkMode.PAN);
    }
    this.registry.removeMaster(masterTypeId);

    this.toast.success(
      this.translation.translate('deleteComponent.deleted', { name: def.name }),
      'CustomComponentService'
    );
  }

  /**
   * Drops back to the pan tool when a placement is still armed for the master
   * just opened for editing — opening a library tile's editor from its palette
   * ghost should leave the ghost deselected. No-op when a different (or no)
   * placement is armed, e.g. editing an already-placed instance. Mirrors the
   * delete flow's disarm.
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
  }

  /** The library a registered master belongs to; defaults to browser if unknown. */
  private _sourceForMaster(masterId: string): 'server' | 'browser' {
    const typeId = this.registry.masterTypeIdForId(masterId);
    const def =
      typeId !== undefined ? this.registry.getDefinition(typeId) : undefined;
    return def?.source === 'server' ? 'server' : 'browser';
  }

  /**
   * Closes a component editor tab. A clean editor is disposed straight away; a
   * dirty one prompts **Save / Discard / Cancel** first (dismissing the dialog
   * cancels, keeping the tab, so work is never lost by accident). Saving a cloud
   * component that embeds local components publishes those to the cloud library —
   * that warning is folded into the same dialog. On a failed save the tab is kept
   * open so the user can retry.
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
      // else: save failed (already toasted) — keep the tab open for a retry.
    }
    // dismissed (cancel) — keep the tab open.
  }

  /**
   * Closes a component editor tab with no prompting, discarding any unsaved
   * changes. For flows that have already resolved the dirty question themselves.
   * Regular tab closing goes through {@link closeComponent}.
   */
  public forceCloseComponent(project: Project): void {
    this._disposeEditor(project);
  }

  /**
   * Opens the close-confirmation dialog for a dirty editor, folding in the
   * cloud-promotion warning when saving would publish embedded local components
   * (a cloud document with resolvable local deps). Resolves the user's choice, or
   * `undefined` when the dialog is dismissed (cancel).
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
    this.projectService.removeOpenComponent(project);
    this.metadataStore.remove(project);
    project.destroy();
  }

  /**
   * Builds an undoable action that brings one placed custom instance up to its
   * master's current state: re-snapshot the master, then replace the instance
   * with a fresh one of the new snapshot type at the same position/direction.
   * Returns null if the instance's master can no longer be resolved (e.g. it was
   * deleted) — there is nothing to update against. The instance keeps working
   * either way; this only changes its shape.
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
    // The replacement was only built to be serialized into the action; the
    // real instance is created by the action's add on do(). Drop this one.
    replacement.destroy({ children: true });
    return action;
  }

  /**
   * Ensures a master's circuit is loaded before it is placed or updated. Cloud
   * masters are preloaded summary-only (no circuit); this lazily fetches the
   * circuit on first use. No-op for built-ins, browser masters, and already-loaded
   * masters. Returns whether the circuit is ready: a failed cloud fetch shows a
   * toast and returns `false` so the caller can abort (rather than arm placement /
   * apply an update against empty content).
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
