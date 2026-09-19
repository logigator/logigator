import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  canShare,
  copyText,
  EMBED_FORMATS,
  embedSnippet,
  LgButton,
  LgDialogContent,
  LgIconField,
  LgInputIcon,
  LgInputText,
  LgMessage,
  LgSelectButton,
  LgTextarea,
  LgToggleSwitch,
  LgTooltip,
  shareCardUrl,
  shareOrCopy,
  type LgEmbedFormat
} from '@logigator/ui';
import { TranslationService } from '../../../translation/translation.service';
import { TranslationKey } from '../../../translation/translation-key.model';
import { communityDocumentUrl, shareLandingUrl } from './share-url';
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
  regenerateLink?: boolean;
}

/**
 * The formats an embed can be pasted as, under the key each is named by. Proper
 * nouns, so the four locales say the same thing — but they come from the table
 * anyway, so a translator who needs them spelled otherwise can say so.
 */
const FORMAT_LABELS: Record<LgEmbedFormat, TranslationKey> = {
  markdown: 'shareDialog.formatMarkdown',
  html: 'shareDialog.formatHtml',
  bbcode: 'shareDialog.formatBbcode'
};

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
    LgSelectButton,
    LgTextarea,
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
  protected readonly embedding = signal(false);
  protected readonly format = signal<LgEmbedFormat>(EMBED_FORMATS[0]);

  /**
   * Whether this browser has a sheet to open, which decides what the share
   * button does. Read directly rather than after a render, unlike the site's
   * copy of these controls: the editor is never server-rendered, so there is
   * no second render for the two to disagree with each other.
   */
  protected readonly hasSheet = canShare();

  /**
   * The site's page for this document, which is what a recipient is handed.
   * A `computed` over the active language rather than a field: a URL captured
   * once would keep the language the sharer has since switched away from.
   */
  protected readonly shareUrl = computed(() =>
    shareLandingUrl(this.translation.activeLang(), this.link())
  );

  /** Absolute, because an embed is pasted onto somebody else's site. */
  protected readonly cardUrl = computed(
    () => `${window.location.origin}${shareCardUrl(this.link())}`
  );

  /**
   * Where an embed sends a reader: the community page while the document is
   * published, because a snippet is a link from somebody else's site and the
   * page that can rank is the one it should carry. Unpublished, the share page
   * is the only address there is.
   */
  protected readonly embedUrl = computed(() =>
    this.isPublic()
      ? communityDocumentUrl(
          this.translation.activeLang(),
          this.kind,
          this.link()
        )
      : this.shareUrl()
  );

  protected readonly formatChoices = computed(() =>
    EMBED_FORMATS.map((format) => ({
      value: format,
      label: this.translation.translate(FORMAT_LABELS[format])
    }))
  );

  protected readonly embed = computed(() =>
    embedSnippet(this.format(), {
      url: this.embedUrl(),
      image: this.cardUrl(),
      title: this.name
    })
  );

  /**
   * The sheet where there is one, the clipboard where there is not. A visitor
   * closing the sheet and the sheet's own acknowledgement are both silent: one
   * is a choice, the other needs no announcement.
   */
  protected async share(): Promise<void> {
    const outcome = await shareOrCopy({
      title: this.name,
      url: this.shareUrl()
    });

    if (outcome === 'copied') {
      this.toast.success(
        this.translation.translate('shareDialog.linkCopied'),
        'ShareDialogComponent'
      );
    }
    if (outcome === 'failed') {
      this.toast.error(
        this.translation.translate('shareDialog.copyFailed'),
        'ShareDialogComponent'
      );
    }
  }

  protected async copyLink(): Promise<void> {
    if (await copyText(this.shareUrl())) {
      this.toast.success(
        this.translation.translate('shareDialog.linkCopied'),
        'ShareDialogComponent'
      );
      return;
    }
    // Refused in more situations than it is granted — an insecure origin, a
    // permission the visitor declined — and the URL is in a field they can
    // select, so this is a note rather than a failure.
    this.toast.error(
      this.translation.translate('shareDialog.copyFailed'),
      'ShareDialogComponent'
    );
  }

  protected async copyEmbed(): Promise<void> {
    if (await copyText(this.embed())) {
      this.toast.success(
        this.translation.translate('shareDialog.embedCopied'),
        'ShareDialogComponent'
      );
      return;
    }
    this.toast.error(
      this.translation.translate('shareDialog.embedCopyFailed'),
      'ShareDialogComponent'
    );
  }

  protected async regenerateLink(): Promise<void> {
    if (this.regenerating()) return;
    this.regenerating.set(true);
    try {
      const summary = await this._patch({ regenerateLink: true });
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
