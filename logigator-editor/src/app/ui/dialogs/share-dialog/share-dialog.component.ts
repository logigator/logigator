import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  LgButton,
  LgDialogContent,
  LgIconField,
  LgInputIcon,
  LgInputText,
  LgMessage,
  LgToggleSwitch,
  LgTooltip
} from '@logigator/ui';
import { TranslationService } from '../../../translation/translation.service';
import { ProjectApiService } from '../../../api/services/project-api.service';
import { ComponentApiService } from '../../../api/services/component-api.service';
import { ProjectMetadataStore } from '../../../persistence/project-metadata.store';
import { CustomComponentRegistry } from '../../../components/custom/custom-component-registry.service';
import { ToastService } from '../../../logging/toast.service';
import { AnalyticsService } from '../../../analytics/analytics.service';
import { AnalyticsEvent } from '../../../analytics/analytics.mapping';
import { TranslateDirective } from '../../../translation/translate.directive';

/** The share-mutating subset both the project and component PATCH accept. */
interface ShareLinkPatch {
  public?: boolean;
  updateLink?: boolean;
}

/** What every dialog kind supplies up front. */
interface ShareDialogBase {
  name: string;
  link: string;
  isPublic: boolean;
}

export type ShareDialogData =
  /**
   * A cloud project addressed by its server id. Visibility and link changes
   * sync back into the metadata store when that project is open, and are a
   * no-op otherwise. The current values are passed in, so the dialog needs no
   * fetch and no live `Project` reference.
   */
  | ({ kind: 'project'; projectId: string } & ShareDialogBase)
  /**
   * A cloud custom-component master. `componentId` is the server id PATCHes go
   * to, `masterTypeId` addresses the registry for write-back.
   */
  | ({
      kind: 'component';
      componentId: string;
      masterTypeId: number;
    } & ShareDialogBase);

/**
 * Manages a cloud project's or custom component's share link: shows the public
 * `/share/:link` URL with a copy button, regenerates the link (invalidating the
 * old one) and toggles public visibility. Both kinds always carry a link, so
 * the URL is never empty. Changes write back into the session so it stays fresh
 * without a re-fetch.
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
    TranslateDirective
  ],
  templateUrl: './share-dialog.component.html'
})
export class ShareDialogComponent extends LgDialogContent<ShareDialogData> {
  private readonly projectApi = inject(ProjectApiService);
  private readonly componentApi = inject(ComponentApiService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly registry = inject(CustomComponentRegistry);
  private readonly toast = inject(ToastService);
  private readonly translation = inject(TranslationService);
  private readonly analytics = inject(AnalyticsService);

  private readonly data = this.dialogData!;

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
        this.translation.translate('shareDialog.linkCopied'),
        'ShareDialogComponent'
      );
    } catch (err) {
      this.toast.error(
        this.translation.translate('shareDialog.copyFailed'),
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
      this.analytics.capture(AnalyticsEvent.ShareLinkGenerated, {
        kind: this.kind
      });
      this.toast.success(
        this.translation.translate('shareDialog.linkRegenerated'),
        'ShareDialogComponent'
      );
    } catch (err) {
      this.toast.error(
        this.translation.translate('shareDialog.regenerateFailed'),
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
        this.translation.translate('shareDialog.visibilityUpdated'),
        'ShareDialogComponent'
      );
    } catch (err) {
      this.isPublic.set(previous);
      this.toast.error(
        this.translation.translate('shareDialog.visibilityFailed'),
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
   * Writes a mutated link or visibility back into the session: for a component
   * onto its master definition, for a project onto the metadata store entry
   * addressed by id — a no-op when that project is not loaded.
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
    this.dialogRef.close();
  }
}
