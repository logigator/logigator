import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DialogService } from '@logigator/ui';
import { TranslocoService } from '@jsverse/transloco';
import { PersistenceService } from '../persistence/persistence.service';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { ToastService } from '../logging/toast.service';
import { Project } from '../project/project';
import { UploadCoordinatorService } from './upload/upload-coordinator.service';
import {
  SaveProjectDialogComponent,
  SaveProjectDialogResult
} from './save-project-dialog/save-project-dialog.component';

/**
 * Single entry point for the "Save" action shared by the title bar, tool bar
 * and Ctrl+S shortcut. A never-saved project draft (`type:'project'`,
 * `source:'browser'`, no id — i.e. the blank board created on a fresh page load
 * or via "New Project") is prompted once for a name + destination via
 * {@link SaveProjectDialogComponent} before its first write; everything already
 * persisted (server projects, browser projects with an id, component editors)
 * goes straight to {@link PersistenceService.saveProject}.
 */
@Injectable({ providedIn: 'root' })
export class SaveCoordinatorService {
  private readonly persistence = inject(PersistenceService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly dialogService = inject(DialogService);
  private readonly translocoService = inject(TranslocoService);
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
        // A server document (project or component editor) that has gained local
        // custom components can't be saved as-is — a cloud document may only
        // contain cloud components. Route it through the upload flow to promote
        // them first; cancelling aborts the save. Everything else saves directly.
        if (
          metadata.source === 'server' &&
          this.persistence.localDependenciesOfProject(project).length > 0
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
        // A first server save runs through the upload flow so any local custom
        // components the draft embeds are offered for cloud upload + linking,
        // exactly like promoting an already-saved project. The coordinator owns
        // its own dialog, error and success toasts.
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
      this.toast.error(
        this.translocoService.translate('persistence.saveFailedGeneric'),
        'SaveCoordinatorService',
        err
      );
    }
  }

  private _promptSaveDetails(
    currentName: string
  ): Promise<SaveProjectDialogResult | undefined> {
    const ref = this.dialogService.open(SaveProjectDialogComponent, {
      header: this.translocoService.translate(
        'titleBar.menuBar.file.items.save.label'
      ),
      width: '28rem',
      modal: true,
      closable: true,
      data: { name: currentName }
    });
    if (!ref) return Promise.resolve(undefined);
    return firstValueFrom(ref.onClose) as Promise<
      SaveProjectDialogResult | undefined
    >;
  }
}
