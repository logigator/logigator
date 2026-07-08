import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DialogService } from '@logigator/ui';
import { TranslocoService } from '@jsverse/transloco';
import {
  LocalUploadDependency,
  PersistenceService
} from '../../persistence/persistence.service';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { ToastService } from '../../logging/toast.service';
import { Project } from '../../project/project';
import {
  UploadDialogComponent,
  UploadDialogData,
  UploadDialogResult
} from './upload-dialog.component';

/** What is being moved to the cloud. */
export type UploadTarget =
  /** The currently open project (title bar, File menu). */
  | { kind: 'project'; project: Project }
  /** A browser project by store id (the Open dialog's local list). */
  | { kind: 'stored-project'; id: string; name: string }
  /** A local custom-component master (the component actions panel). */
  | { kind: 'component'; masterTypeId: number }
  /**
   * A never-saved project draft being saved to the server for the first time.
   * Its name + visibility are already chosen in the save dialog, so the upload
   * dialog is shown only to pick which embedded local components to promote —
   * and skipped entirely when there are none.
   */
  | {
      kind: 'draft-to-server';
      project: Project;
      name: string;
      isPublic: boolean;
    }
  /**
   * An already-saved **server** project being re-saved after it gained local
   * components (which the backend rejects as dependencies). Promotes the chosen
   * ones — riding the project's own visibility — then re-saves. Only routed here
   * when the project actually embeds local components.
   */
  | { kind: 'save-server'; project: Project };

/**
 * Single entry point for moving anything local to the cloud — projects and
 * custom components share one pipeline: analyze which local custom components
 * the circuit embeds, prompt with {@link UploadDialogComponent} (visibility +
 * dependency selection), upload the chosen dependencies **first**
 * (children-before-parents, so each later upload references its
 * already-promoted children via the serialize-time id rewrite), then the target
 * itself. Owns all upload toasts; failures stop the sequence — everything not
 * yet uploaded is untouched, so the user can simply retry (already-promoted
 * dependencies drop out of the next analysis).
 *
 * Resolves `true` when the target committed, so list callers can refresh.
 */
@Injectable({ providedIn: 'root' })
export class UploadCoordinatorService {
  private readonly persistence = inject(PersistenceService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly registry = inject(CustomComponentRegistry);
  private readonly dialogService = inject(DialogService);
  private readonly transloco = inject(TranslocoService);
  private readonly toast = inject(ToastService);

  async requestUpload(target: UploadTarget): Promise<boolean> {
    let name: string;
    let dependencies: LocalUploadDependency[];
    try {
      ({ name, dependencies } = await this._analyze(target));
    } catch (err) {
      this.toast.error(
        this.transloco.translate('uploadDialog.analyzeFailed'),
        'UploadCoordinatorService',
        err
      );
      return false;
    }

    // When visibility is already decided upstream (a first server save, or a
    // re-save riding the project's own visibility) and there is nothing
    // promotable to publish, there is nothing to decide — skip the dialog. Only
    // resolvable dependencies are ever promoted, so an orphan-only document (no
    // library master to publish) skips too. Every other case prompts (the dialog
    // now only confirms + collects visibility; promotion is mandatory, so there
    // is no per-component choice).
    const resolvable = this._resolvable(dependencies);
    const preset = this._presetVisibility(target);
    let isPublic: boolean;
    if (preset !== undefined && resolvable.length === 0) {
      isPublic = preset;
    } else {
      const result = await this._prompt(target, name, dependencies, preset);
      if (!result) return false;
      isPublic = result.isPublic;
    }

    // A cloud document may only contain cloud components, so promote **every**
    // resolvable local dependency (children-before-parents). An unresolvable one
    // (no library master) cannot be promoted and rides along as an embedded copy.
    if (!(await this._uploadDependencies(resolvable, isPublic))) {
      return false;
    }

    try {
      await this._uploadTarget(target, isPublic);
    } catch (err) {
      // `save-server` delegates to `saveProject`, which surfaces its own error;
      // toasting here too would stack a second error. Every other target's
      // primitive is silent, so the coordinator reports the failure.
      if (target.kind !== 'save-server') {
        this.toast.error(
          this.transloco.translate('uploadDialog.uploadFailed', { name }),
          'UploadCoordinatorService',
          err
        );
      }
      return false;
    }

    // A plain re-save (`save-server`) reports its own outcome via `saveProject`;
    // every other target's primitive is silent, so the coordinator toasts.
    const successKey = this._successKey(target);
    if (successKey) {
      this.toast.success(
        this.transloco.translate(successKey),
        'UploadCoordinatorService'
      );
    }
    return true;
  }

  /**
   * Promotes a document's local components (if it is a cloud document) and then
   * saves it — **without** a dialog, for callers that have already obtained the
   * user's consent (the tab-close prompt). A browser document just saves (local
   * components are fine there). Local components ride the document's own
   * visibility. Returns whether everything committed; `saveProject` reports its
   * own outcome, so no toast is emitted here beyond a dependency failure.
   */
  async promoteLocalDepsAndSave(project: Project): Promise<boolean> {
    const metadata = this.metadataStore.getMetadata(project);
    if (metadata?.source === 'server') {
      const deps = this._resolvable(
        this.persistence.localDependenciesOfProject(project)
      );
      if (!(await this._uploadDependencies(deps, metadata.isPublic))) {
        return false;
      }
    }
    try {
      await this.persistence.saveProject(project);
      return true;
    } catch {
      return false; // saveProject already surfaced the error
    }
  }

  /**
   * The visibility already chosen for a target outside the upload dialog, or
   * `undefined` when the dialog must ask. A first server save carries it from the
   * save dialog; a server re-save rides the project's own visibility. Either way
   * the dialog locks the toggle, so it is purely about component selection.
   */
  private _presetVisibility(target: UploadTarget): boolean | undefined {
    if (target.kind === 'draft-to-server') return target.isPublic;
    if (target.kind === 'save-server') {
      return this.metadataStore.getMetadata(target.project)?.isPublic ?? false;
    }
    return undefined;
  }

  /** The resolvable local dependencies' master type ids, children-before-parents. */
  private _resolvable(dependencies: LocalUploadDependency[]): number[] {
    return dependencies
      .map((d) => d.masterTypeId)
      .filter((id): id is number => id !== null);
  }

  /**
   * Uploads the chosen dependencies first, children-before-parents: each
   * promotion registers an id alias, and serialization resolves provenance
   * through those aliases, so every subsequent upload (and the target) references
   * the cloud entries created before it. Returns `false` on the first failure —
   * nothing after it is uploaded, so a retry re-analyzes cleanly.
   */
  private async _uploadDependencies(
    masterTypeIds: number[],
    isPublic: boolean
  ): Promise<boolean> {
    for (const masterTypeId of masterTypeIds) {
      const depName = this.registry.getDefinition(masterTypeId)?.name ?? '';
      try {
        await this.persistence.promoteComponentToServer(masterTypeId, isPublic);
      } catch (err) {
        this.toast.error(
          this.transloco.translate('uploadDialog.dependencyFailed', {
            name: depName
          }),
          'UploadCoordinatorService',
          err
        );
        return false;
      }
    }
    return true;
  }

  private _successKey(target: UploadTarget) {
    if (target.kind === 'component') return 'persistence.componentUploaded';
    // A first server save reads as a save, not a move.
    if (target.kind === 'draft-to-server') return 'persistence.projectSaved';
    // A re-save reports its own outcome via saveProject; don't double-toast.
    if (target.kind === 'save-server') return undefined;
    return 'persistence.projectUploaded';
  }

  /** The target's display name and embedded local dependencies. */
  private async _analyze(
    target: UploadTarget
  ): Promise<{ name: string; dependencies: LocalUploadDependency[] }> {
    switch (target.kind) {
      case 'project':
        return {
          name: this.metadataStore.getMetadata(target.project)?.name ?? '',
          dependencies: this.persistence.localDependenciesOfProject(
            target.project
          )
        };
      case 'stored-project':
        return {
          name: target.name,
          dependencies: await this.persistence.localDependenciesOfStoredProject(
            target.id
          )
        };
      case 'component':
        return {
          name: this.registry.getDefinition(target.masterTypeId)?.name ?? '',
          dependencies: await this.persistence.localDependencies(
            target.masterTypeId
          )
        };
      case 'draft-to-server':
        // The draft's metadata name is still 'Untitled' until the save writes
        // the chosen one, so take it from the target.
        return {
          name: target.name,
          dependencies: this.persistence.localDependenciesOfProject(
            target.project
          )
        };
      case 'save-server':
        return {
          name: this.metadataStore.getMetadata(target.project)?.name ?? '',
          dependencies: this.persistence.localDependenciesOfProject(
            target.project
          )
        };
    }
  }

  private _uploadTarget(target: UploadTarget, isPublic: boolean): Promise<void> {
    switch (target.kind) {
      case 'project':
        return this.persistence.promoteProjectToServer(
          target.project,
          isPublic
        );
      case 'stored-project':
        return this.persistence.uploadStoredProjectToServer(
          target.id,
          isPublic
        );
      case 'component':
        return this.persistence.promoteComponentToServer(
          target.masterTypeId,
          isPublic
        );
      case 'draft-to-server':
        return this.persistence.saveDraftAsServer(
          target.project,
          target.name,
          isPublic
        );
      case 'save-server':
        return this.persistence.saveProject(target.project);
    }
  }

  private _prompt(
    target: UploadTarget,
    name: string,
    dependencies: LocalUploadDependency[],
    presetIsPublic: boolean | undefined
  ): Promise<UploadDialogResult | undefined> {
    const ref = this.dialogService.open(UploadDialogComponent, {
      header: this.transloco.translate('uploadDialog.header'),
      width: '28rem',
      modal: true,
      closable: true,
      data: {
        kind: this._dialogKind(target),
        name,
        dependencies,
        // When visibility is decided upstream, lock it so the dialog is purely
        // about which local components to promote.
        presetIsPublic
      } satisfies UploadDialogData
    });
    if (!ref) return Promise.resolve(undefined);
    return firstValueFrom(ref.onClose) as Promise<
      UploadDialogResult | undefined
    >;
  }

  private _dialogKind(target: UploadTarget): UploadDialogData['kind'] {
    if (target.kind === 'component') return 'component';
    // Both the first-save and re-save shapes present the same choice: which
    // embedded local components to promote alongside the project.
    if (target.kind === 'draft-to-server' || target.kind === 'save-server') {
      return 'draft';
    }
    return 'project';
  }
}
