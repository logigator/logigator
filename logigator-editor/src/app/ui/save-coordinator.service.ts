import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DialogService } from '@logigator/ui';
import { DialogId } from '../analytics/analytics.mapping';
import { TranslationService } from '../translation/translation.service';
import { PersistenceService } from '../persistence/persistence.service';
import { PromotionService } from '../persistence/promotion.service';
import { isHandledSaveError } from '../persistence/persistence-errors';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { ToastService } from '../logging/toast.service';
import { Project } from '../project/project';
import { UploadCoordinatorService } from './upload/upload-coordinator.service';
import {
  SaveProjectDialogComponent,
  SaveProjectDialogResult
} from './dialogs/save-project-dialog/save-project-dialog.component';

/**
 * Single entry point for the "Save" action. A never-saved draft — a browser
 * project with no id, i.e. a blank board — is prompted once for a name and
 * destination before its first write; everything already persisted goes
 * straight to {@link PersistenceService.saveProject}.
 */
@Injectable({ providedIn: 'root' })
export class SaveCoordinatorService {
  private readonly persistence = inject(PersistenceService);
  private readonly promotion = inject(PromotionService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly dialogService = inject(DialogService);
  private readonly translation = inject(TranslationService);
  private readonly toast = inject(ToastService);
  private readonly uploadCoordinator = inject(UploadCoordinatorService);

  async requestSave(project: Project): Promise<void> {
    const metadata = this.metadataStore.getMetadata(project);
    if (!metadata) return;

    const isFreshDraft =
      metadata.type === 'project' &&
      metadata.source === 'browser' &&
      metadata.id === '';

    try {
      if (!isFreshDraft) {
        // A cloud document may only contain cloud components, so a server
        // document that gained a *promotable* local one routes through the
        // upload flow first; cancelling aborts the save. An orphan cannot be
        // promoted and rides along embedded, so it does not force the dialog.
        if (
          metadata.source === 'server' &&
          this.promotion
            .localDependenciesOfProject(project)
            .some((dep) => dep.masterTypeId !== null)
        ) {
          await this.uploadCoordinator.requestUpload({
            kind: 'save-server',
            project
          });
          return;
        }
        await this.persistence.saveProject(project);
        return;
      }

      const result = await this._promptSaveDetails(metadata.name);
      if (!result) return; // dialog cancelled

      if (result.destination === 'server') {
        // Through the upload flow so the draft's embedded local components are
        // promoted and linked, exactly like promoting a saved project. The
        // coordinator owns its own dialog and toasts.
        await this.uploadCoordinator.requestUpload({
          kind: 'draft-to-server',
          project,
          name: result.name,
          isPublic: result.isPublic
        });
      } else {
        await this.persistence.saveDraftAsLocal(project, result.name);
      }
    } catch (err) {
      // A signed-out or foreign-account rejection already toasted its specific
      // reason at the guard; a generic failure on top would obscure it.
      if (isHandledSaveError(err)) return;
      this.toast.error(
        this.translation.translate('persistence.saveFailedGeneric'),
        'SaveCoordinatorService',
        err
      );
    }
  }

  private _promptSaveDetails(
    currentName: string
  ): Promise<SaveProjectDialogResult | undefined> {
    const ref = this.dialogService.open(SaveProjectDialogComponent, {
      header: this.translation.translate(
        'titleBar.menuBar.file.items.save.label'
      ),
      width: '28rem',
      modal: true,
      closable: true,
      telemetryId: DialogId.SaveProject,
      data: { name: currentName }
    });
    if (!ref) return Promise.resolve(undefined);
    return firstValueFrom(ref.onClose);
  }
}
