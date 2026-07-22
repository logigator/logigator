import { inject, Injectable } from '@angular/core';
import { ConfirmationService } from '@logigator/ui';
import { TranslationService } from '../translation/translation.service';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { ProjectService } from '../project/project.service';

/**
 * The shared gate in front of replacing the main project: anything that swaps
 * a new document into the main slot throws the current one away, so a dirty
 * board must be confirmed first.
 */
@Injectable({ providedIn: 'root' })
export class DiscardChangesService {
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translation = inject(TranslationService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly projectService = inject(ProjectService);

  /**
   * Resolves `true` when the main project may be discarded — it has no unsaved
   * changes, or the user accepted the confirmation — and `false` when the user
   * cancelled (rejecting or dismissing the dialog).
   */
  public confirmDiscardMain(): Promise<boolean> {
    const project = this.projectService.mainProject();
    if (!project || !this.metadataStore.isDirty(project)) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      this.confirmationService.confirm({
        header: this.translation.translate('discardChanges.header'),
        message: this.translation.translate('discardChanges.message'),
        acceptButtonProps: { severity: 'danger' },
        acceptLabel: this.translation.translate('discardChanges.accept'),
        rejectButtonProps: { severity: 'secondary', outlined: true },
        rejectLabel: this.translation.translate('discardChanges.reject'),
        accept: () => resolve(true),
        reject: () => resolve(false)
      });
    });
  }
}
