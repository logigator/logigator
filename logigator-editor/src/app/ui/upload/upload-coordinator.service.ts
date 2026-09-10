import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DialogService } from '@logigator/ui';
import { DialogId } from '../../analytics/analytics.mapping';
import { TranslationService } from '../../translation/translation.service';
import { PersistenceService } from '../../persistence/persistence.service';
import {
  LocalUploadDependency,
  PromotionService
} from '../../persistence/promotion.service';
import { isHandledSaveError } from '../../persistence/persistence-errors';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { ToastService } from '../../logging/toast.service';
import { Project } from '../../project/project';
import {
  UploadDialogComponent,
  UploadDialogData,
  UploadDialogResult
} from '../dialogs/upload-dialog/upload-dialog.component';

/** What is being moved to the cloud. */
export type UploadTarget =
  /** The currently open project. */
  | { kind: 'project'; project: Project }
  /** A browser project by store id. */
  | { kind: 'stored-project'; id: string; name: string }
  /** A local custom-component master. */
  | { kind: 'component'; masterTypeId: number }
  /**
   * A never-saved draft being saved to the server for the first time. Name and
   * visibility come from the save dialog, so the upload dialog only picks the
   * embedded local components to promote, and is skipped when there are none.
   */
  | {
      kind: 'draft-to-server';
      project: Project;
      name: string;
      isPublic: boolean;
    }
  /**
   * A saved **server** project being re-saved after it gained local components,
   * which the server rejects as dependencies. Promotes them on the project's
   * own visibility, then re-saves.
   */
  | { kind: 'save-server'; project: Project };

/**
 * Single entry point for moving anything local to the cloud; projects and
 * custom components share one pipeline. Analyze which local custom components
 * the circuit embeds, prompt for visibility, upload the dependencies **first**
 * (children-before-parents, so each later upload references its
 * already-promoted children through the serialize-time id rewrite), then the
 * target itself.
 *
 * Owns all upload toasts. A failure stops the sequence, leaving everything not
 * yet uploaded untouched, so a retry re-analyzes cleanly.
 */
@Injectable({ providedIn: 'root' })
export class UploadCoordinatorService {
  private readonly persistence = inject(PersistenceService);
  private readonly promotion = inject(PromotionService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly registry = inject(CustomComponentRegistry);
  private readonly dialogService = inject(DialogService);
  private readonly translation = inject(TranslationService);
  private readonly toast = inject(ToastService);

  async requestUpload(target: UploadTarget): Promise<boolean> {
    let name: string;
    let dependencies: LocalUploadDependency[];
    try {
      ({ name, dependencies } = await this._analyze(target));
    } catch (err) {
      this.toast.error(
        this.translation.translate('uploadDialog.analyzeFailed'),
        'UploadCoordinatorService',
        err
      );
      return false;
    }

    // Skip the dialog when visibility is already decided upstream and there is
    // nothing promotable to publish. Only resolvable dependencies are ever
    // promoted, so an orphan-only document (no library master) skips too.
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

    // A cloud document may only contain cloud components, so promote every
    // resolvable local dependency. An unresolvable one cannot be promoted and
    // rides along as an embedded copy.
    if (!(await this._uploadDependencies(resolvable, isPublic))) {
      return false;
    }

    try {
      await this._uploadTarget(target, isPublic);
    } catch (err) {
      // `saveProject` surfaces its own error, and a signed-out or
      // foreign-account rejection is already toasted at the guard; every other
      // primitive is silent, so the coordinator reports those.
      if (target.kind !== 'save-server' && !isHandledSaveError(err)) {
        this.toast.error(
          this.translation.translate('uploadDialog.uploadFailed', { name }),
          'UploadCoordinatorService',
          err
        );
      }
      return false;
    }

    const successKey = this._successKey(target);
    if (successKey) {
      this.toast.success(
        this.translation.translate(successKey),
        'UploadCoordinatorService'
      );
    }
    return true;
  }

  /**
   * Promotes a cloud document's local components on its own visibility and
   * then saves it, **without** a dialog, for consent obtained elsewhere. A
   * browser document just saves; local components are fine there. Returns
   * whether everything committed. `saveProject` reports its own outcome, so
   * nothing but a dependency failure is toasted here.
   */
  async promoteLocalDepsAndSave(project: Project): Promise<boolean> {
    const metadata = this.metadataStore.getMetadata(project);
    if (metadata?.source === 'server') {
      const deps = this._resolvable(
        this.promotion.localDependenciesOfProject(project)
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
   * The visibility already chosen outside the upload dialog, or `undefined`
   * when the dialog must ask. A first server save carries it from the save
   * dialog, a re-save rides the project's own; either way the toggle locks.
   */
  private _presetVisibility(target: UploadTarget): boolean | undefined {
    if (target.kind === 'draft-to-server') return target.isPublic;
    if (target.kind === 'save-server') {
      return this.metadataStore.getMetadata(target.project)?.isPublic ?? false;
    }
    return undefined;
  }

  /** Resolvable dependencies' master type ids, children-before-parents. */
  private _resolvable(dependencies: LocalUploadDependency[]): number[] {
    return dependencies
      .map((d) => d.masterTypeId)
      .filter((id): id is number => id !== null);
  }

  /**
   * Uploads dependencies children-before-parents: each promotion registers an
   * id alias and serialization resolves provenance through those aliases, so
   * every later upload references the cloud entries created before it. Returns
   * `false` on the first failure, leaving the rest unuploaded.
   */
  private async _uploadDependencies(
    masterTypeIds: number[],
    isPublic: boolean
  ): Promise<boolean> {
    for (const masterTypeId of masterTypeIds) {
      const depName = this.registry.getDefinition(masterTypeId)?.name ?? '';
      try {
        await this.promotion.promoteComponentToServer(masterTypeId, isPublic);
      } catch (err) {
        if (!isHandledSaveError(err)) {
          this.toast.error(
            this.translation.translate('uploadDialog.dependencyFailed', {
              name: depName
            }),
            'UploadCoordinatorService',
            err
          );
        }
        return false;
      }
    }
    return true;
  }

  private _successKey(target: UploadTarget) {
    if (target.kind === 'component') return 'persistence.componentUploaded';
    // A first server save reads as a save, not a move.
    if (target.kind === 'draft-to-server') return 'persistence.projectSaved';
    // A re-save reports its own outcome via `saveProject`.
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
          dependencies: this.promotion.localDependenciesOfProject(
            target.project
          )
        };
      case 'stored-project':
        return {
          name: target.name,
          dependencies: await this.promotion.localDependenciesOfStoredProject(
            target.id
          )
        };
      case 'component':
        return {
          name: this.registry.getDefinition(target.masterTypeId)?.name ?? '',
          dependencies: await this.promotion.localDependencies(
            target.masterTypeId
          )
        };
      case 'draft-to-server':
        // The draft's metadata name stays 'Untitled' until the save writes the
        // chosen one, so take it from the target.
        return {
          name: target.name,
          dependencies: this.promotion.localDependenciesOfProject(
            target.project
          )
        };
      case 'save-server':
        return {
          name: this.metadataStore.getMetadata(target.project)?.name ?? '',
          dependencies: this.promotion.localDependenciesOfProject(
            target.project
          )
        };
    }
  }

  private _uploadTarget(
    target: UploadTarget,
    isPublic: boolean
  ): Promise<void> {
    switch (target.kind) {
      case 'project':
        return this.promotion.promoteProjectToServer(target.project, isPublic);
      case 'stored-project':
        return this.promotion.uploadStoredProjectToServer(target.id, isPublic);
      case 'component':
        return this.promotion.promoteComponentToServer(
          target.masterTypeId,
          isPublic
        );
      case 'draft-to-server':
        return this.promotion.saveDraftAsServer(
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
      header: this.translation.translate('uploadDialog.header'),
      width: '28rem',
      modal: true,
      closable: true,
      telemetryId: DialogId.Upload,
      data: {
        kind: this._dialogKind(target),
        name,
        dependencies,
        // Locks the toggle when visibility is decided upstream.
        presetIsPublic
      }
    });
    if (!ref) return Promise.resolve(undefined);
    return firstValueFrom(ref.onClose);
  }

  private _dialogKind(target: UploadTarget): UploadDialogData['kind'] {
    if (target.kind === 'component') return 'component';
    // Both save shapes present the same choice: which embedded local components
    // to promote alongside the project.
    if (target.kind === 'draft-to-server' || target.kind === 'save-server') {
      return 'draft';
    }
    return 'project';
  }
}
