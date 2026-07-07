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
  | { kind: 'component'; masterTypeId: number };

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

    const result = await this._prompt(target, name, dependencies);
    if (!result) return false;

    // Dependencies first, children-before-parents: each promotion registers an
    // id alias, and serialization resolves provenance through those aliases, so
    // every subsequent upload references the cloud entries created before it.
    for (const masterTypeId of result.dependencyMasterTypeIds) {
      const depName = this.registry.getDefinition(masterTypeId)?.name ?? '';
      try {
        await this.persistence.promoteComponentToServer(
          masterTypeId,
          result.isPublic
        );
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

    try {
      await this._uploadTarget(target, result.isPublic);
    } catch (err) {
      this.toast.error(
        this.transloco.translate('uploadDialog.uploadFailed', { name }),
        'UploadCoordinatorService',
        err
      );
      return false;
    }

    this.toast.success(
      this.transloco.translate(
        target.kind === 'component'
          ? 'persistence.componentUploaded'
          : 'persistence.projectUploaded'
      ),
      'UploadCoordinatorService'
    );
    return true;
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
    }
  }

  private _prompt(
    target: UploadTarget,
    name: string,
    dependencies: LocalUploadDependency[]
  ): Promise<UploadDialogResult | undefined> {
    const ref = this.dialogService.open(UploadDialogComponent, {
      header: this.transloco.translate('uploadDialog.header'),
      width: '28rem',
      modal: true,
      closable: true,
      data: {
        kind: target.kind === 'component' ? 'component' : 'project',
        name,
        dependencies
      } satisfies UploadDialogData
    });
    if (!ref) return Promise.resolve(undefined);
    return firstValueFrom(ref.onClose) as Promise<
      UploadDialogResult | undefined
    >;
  }
}
