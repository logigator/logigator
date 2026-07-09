import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  DialogConfig,
  DialogRef,
  LgButton,
  LgIconField,
  LgInputIcon,
  LgInputText,
  LgMessage,
  LgToggleSwitch,
  LgTooltip
} from '@logigator/ui';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { Project } from '../../project/project';
import { ProjectApiService } from '../../api/services/project-api.service';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { ToastService } from '../../logging/toast.service';

export interface ShareDialogData {
  /** The open cloud project whose share link is managed. */
  project: Project;
}

/**
 * Manages a cloud project's share link: shows the public `/share/:link` URL with
 * a copy button, regenerates the link (invalidating the old one), and toggles the
 * project's public visibility. Every change PATCHes `/api/project/:id` and writes
 * the result back into {@link ProjectMetadataStore} so the source chip and any
 * later save stay in sync. Only opened for `source === 'server'` projects, which
 * always carry a `@Generated('uuid')` link, so the URL is never empty.
 */
@Component({
  selector: 'app-share-dialog',
  imports: [
    FormsModule,
    LgButton,
    LgIconField,
    LgInputIcon,
    LgInputText,
    LgMessage,
    LgToggleSwitch,
    LgTooltip,
    TranslocoDirective
  ],
  templateUrl: './share-dialog.component.html'
})
export class ShareDialogComponent {
  private readonly ref = inject(DialogRef);
  private readonly config = inject(DialogConfig);
  private readonly projectApi = inject(ProjectApiService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  private readonly data = this.config.data as ShareDialogData;
  private readonly project = this.data.project;
  private readonly metadata = this.metadataStore.getMetadata(this.project);

  private readonly projectId = this.metadata?.id ?? '';
  protected readonly name = this.metadata?.name ?? '';

  protected readonly link = signal(this.metadata?.link ?? '');
  protected readonly isPublic = signal(this.metadata?.isPublic ?? false);
  protected readonly regenerating = signal(false);

  protected readonly shareUrl = computed(
    () => `${window.location.origin}/share/${this.link()}`
  );

  protected async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.shareUrl());
      this.toast.success(
        this.transloco.translate('shareDialog.linkCopied'),
        'ShareDialogComponent'
      );
    } catch (err) {
      this.toast.error(
        this.transloco.translate('shareDialog.copyFailed'),
        'ShareDialogComponent',
        err
      );
    }
  }

  protected async regenerateLink(): Promise<void> {
    if (this.regenerating()) return;
    this.regenerating.set(true);
    try {
      const summary = await firstValueFrom(
        this.projectApi.update(this.projectId, { updateLink: true })
      );
      const newLink = summary.link ?? this.link();
      this.link.set(newLink);
      this.metadataStore.update(this.project, { link: newLink });
      this.toast.success(
        this.transloco.translate('shareDialog.linkRegenerated'),
        'ShareDialogComponent'
      );
    } catch (err) {
      this.toast.error(
        this.transloco.translate('shareDialog.regenerateFailed'),
        'ShareDialogComponent',
        err
      );
    } finally {
      this.regenerating.set(false);
    }
  }

  protected async setPublic(value: boolean): Promise<void> {
    const previous = this.isPublic();
    if (value === previous) return;
    this.isPublic.set(value);
    try {
      const summary = await firstValueFrom(
        this.projectApi.update(this.projectId, { public: value })
      );
      this.isPublic.set(summary.public);
      this.metadataStore.update(this.project, { isPublic: summary.public });
      this.toast.success(
        this.transloco.translate('shareDialog.visibilityUpdated'),
        'ShareDialogComponent'
      );
    } catch (err) {
      this.isPublic.set(previous);
      this.toast.error(
        this.transloco.translate('shareDialog.visibilityFailed'),
        'ShareDialogComponent',
        err
      );
    }
  }

  protected close(): void {
    this.ref.close();
  }
}
