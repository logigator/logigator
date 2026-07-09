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
import { ProjectApiService } from '../../api/services/project-api.service';
import { ComponentApiService } from '../../api/services/component-api.service';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { ToastService } from '../../logging/toast.service';

/** The share-mutating subset both the project and component PATCH accept. */
interface ShareLinkPatch {
  public?: boolean;
  updateLink?: boolean;
}

/** Name/link/visibility every dialog kind supplies up front. */
interface ShareDialogBase {
  name: string;
  link: string;
  isPublic: boolean;
}

export type ShareDialogData =
  /**
   * A cloud project addressed by its server id. Visibility/link changes sync back
   * into the metadata store if that project is currently open (a no-op otherwise),
   * so the source chip and any later save stay in sync. Callers pass the current
   * name/link/visibility directly — the open File-menu path from the metadata
   * store, the open-project dialog from the listed summary — so the dialog needs
   * no fetch and no live `Project` reference.
   */
  | ({ kind: 'project'; projectId: string } & ShareDialogBase)
  /**
   * A cloud custom-component master. Its share link + visibility are read from
   * the master definition (already preloaded), so they are passed in directly;
   * `componentId` is the server id used for PATCHes and `masterTypeId` addresses
   * the registry for write-back.
   */
  | ({
      kind: 'component';
      componentId: string;
      masterTypeId: number;
    } & ShareDialogBase);

/**
 * Manages a cloud project's or custom component's share link: shows the public
 * `/share/:link` URL with a copy button, regenerates the link (invalidating the
 * old one), and toggles public visibility. Both kinds carry a `@Generated('uuid')`
 * link, so the URL is never empty. Initial name/link/visibility are passed in by
 * the caller; changes write back to keep the session fresh without a re-fetch — a
 * project into the {@link ProjectMetadataStore} entry of the open project (if any),
 * a component onto its master definition through the registry.
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
  private readonly componentApi = inject(ComponentApiService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly registry = inject(CustomComponentRegistry);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  private readonly data = this.config.data as ShareDialogData;

  protected readonly kind = this.data.kind;
  protected readonly name = this.data.name;

  protected readonly link = signal(this.data.link);
  protected readonly isPublic = signal(this.data.isPublic);
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
      const summary = await this._patch({ updateLink: true });
      const newLink = summary.link ?? this.link();
      this.link.set(newLink);
      this._persist({ link: newLink });
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
      const summary = await this._patch({ public: value });
      this.isPublic.set(summary.public);
      this._persist({ isPublic: summary.public });
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

  /** PATCHes the project or component and resolves its `{ link?, public }`. */
  private _patch(
    body: ShareLinkPatch
  ): Promise<{ link?: string; public: boolean }> {
    if (this.data.kind === 'project') {
      return firstValueFrom(this.projectApi.update(this.data.projectId, body));
    }
    return firstValueFrom(
      this.componentApi.update(this.data.componentId, body)
    );
  }

  /**
   * Writes a mutated link/visibility back into the session so it stays fresh
   * without a re-fetch: for a component, onto its master definition; for a
   * project, onto the metadata store entry of the open project addressed by id —
   * a no-op when that project is not currently loaded.
   */
  private _persist(patch: { link?: string; isPublic?: boolean }): void {
    if (this.data.kind === 'component') {
      this.registry.setMasterShareInfo(this.data.masterTypeId, patch);
      return;
    }
    const handle = this.metadataStore.getHandleById(this.data.projectId);
    if (handle) this.metadataStore.update(handle.project, patch);
  }

  protected close(): void {
    this.ref.close();
  }
}
