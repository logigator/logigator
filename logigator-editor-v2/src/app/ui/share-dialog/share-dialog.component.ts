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
import { ComponentApiService } from '../../api/services/component-api.service';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { ToastService } from '../../logging/toast.service';

/** The share-mutating subset both the project and component PATCH accept. */
type ShareLinkPatch = { public?: boolean; updateLink?: boolean };

export type ShareDialogData =
  /** The open cloud project; visibility syncs back into the metadata store. */
  | { kind: 'project'; project: Project }
  /**
   * A cloud custom-component master. Its share link + visibility are read from
   * the master definition (already preloaded), so they are passed in directly;
   * `componentId` is the server id used for PATCHes and `masterTypeId` addresses
   * the registry for write-back.
   */
  | {
      kind: 'component';
      componentId: string;
      masterTypeId: number;
      name: string;
      link: string;
      isPublic: boolean;
    };

/**
 * Manages a cloud project's or custom component's share link: shows the public
 * `/share/:link` URL with a copy button, regenerates the link (invalidating the
 * old one), and toggles public visibility. Both kinds carry a `@Generated('uuid')`
 * link, so the URL is never empty. A project reads its link/visibility from the
 * already-loaded {@link ProjectMetadataStore} and writes changes back into it
 * (keeping the source chip in sync); a component reads its link/visibility from
 * the already-preloaded master definition (passed in via the dialog data) and
 * writes changes back onto that master through the registry — no fetch either way.
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

  /** Initial name/link/visibility, read synchronously from the right store. */
  private readonly _init =
    this.data.kind === 'component'
      ? {
          name: this.data.name,
          link: this.data.link,
          isPublic: this.data.isPublic
        }
      : (() => {
          const metadata = this.metadataStore.getMetadata(this.data.project);
          return {
            name: metadata?.name ?? '',
            link: metadata?.link ?? '',
            isPublic: metadata?.isPublic ?? false
          };
        })();

  protected readonly kind = this.data.kind;
  protected readonly name = this._init.name;

  protected readonly link = signal(this._init.link);
  protected readonly isPublic = signal(this._init.isPublic);
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
      return firstValueFrom(
        this.projectApi.update(
          this.metadataStore.getMetadata(this.data.project)?.id ?? '',
          body
        )
      );
    }
    return firstValueFrom(this.componentApi.update(this.data.componentId, body));
  }

  /**
   * Writes a mutated link/visibility back into the session store it was read
   * from, so it stays fresh without a re-fetch: the metadata store for a project,
   * the registry's master definition for a component.
   */
  private _persist(patch: { link?: string; isPublic?: boolean }): void {
    if (this.data.kind === 'project') {
      this.metadataStore.update(this.data.project, patch);
    } else {
      this.registry.setMasterShareInfo(this.data.masterTypeId, patch);
    }
  }

  protected close(): void {
    this.ref.close();
  }
}
