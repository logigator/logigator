import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  copyText,
  LgButton,
  LgDialogContent,
  LgIconField,
  LgInputIcon,
  LgInputText,
  LgMessage,
  LgToggleSwitch,
  ToastService
} from '@logigator/ui';
import { shareCardUrl } from '../../../documents/crawler-image';
import { ShareControls } from '../../../documents/share-controls';
import type { CommunityKind } from '../../../api/services/community-api.service';
import { DocumentsApiService } from '../../../api/services/documents-api.service';
import { genericFailureKey } from '../../../forms/api-failure';
import { SiteLinks } from '../../../layout/site-links';
import { SITE_ORIGIN } from '../../../seo/site-origin';
import { TranslateDirective } from '../../../translation/translate.directive';
import { TranslationKey } from '../../../translation/translation-key.model';
import { TranslationService } from '../../../translation/translation.service';
import { MyDocumentsService } from '../my-documents.service';

/** The row being shared, as the shelf already holds it. */
export interface ShareDocumentData {
  kind: CommunityKind;
  id: string;
  name: string;
  link: string;
  public: boolean;
}

/** Which control is waiting on the API, not whether one is: the three sit
 * together, and a single flag would busy the two nobody pressed. */
type PendingAction = 'visibility' | 'regenerate' | null;

/**
 * A document's share link and whether it is published.
 *
 * The two are separate powers over one row: the link is a capability that opens
 * the circuit in the editor for anyone holding it, while `public` is what puts
 * the document in the community listings. Regenerating revokes the first and
 * takes the community page down with it, the token being the address that page
 * lives at.
 *
 * Each control writes as it is used rather than on a save, and each write goes
 * back into {@link MyDocumentsService} as it lands: the changes are on the
 * server already, so the grid has to agree with them whether the dialog is
 * closed or dismissed.
 */
@Component({
  selector: 'web-share-document-dialog',
  imports: [
    FormsModule,
    LgButton,
    LgIconField,
    LgInputIcon,
    LgInputText,
    LgMessage,
    LgToggleSwitch,
    ShareControls,
    TranslateDirective
  ],
  templateUrl: './share-document-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShareDocumentDialog extends LgDialogContent<ShareDocumentData> {
  private readonly documentsApi = inject(DocumentsApiService);
  private readonly documents = inject(MyDocumentsService);
  private readonly toast = inject(ToastService);
  private readonly translation = inject(TranslationService);
  private readonly siteLinks = inject(SiteLinks);

  private readonly origin = inject(SITE_ORIGIN).replace(/\/+$/, '');

  private readonly data = this.dialogData!;

  protected readonly kind = this.data.kind;
  protected readonly name = this.data.name;

  protected readonly link = signal(this.data.link);
  protected readonly isPublic = signal(this.data.public);
  protected readonly pending = signal<PendingAction>(null);
  protected readonly failureKey = signal<TranslationKey | null>(null);

  /**
   * The page a link handed out lands on, which is what this dialog is for —
   * the editor's own `/share/:link` route is where that page sends a reader,
   * not an address to pass on.
   */
  protected readonly shareUrl = computed(() =>
    this.absolute(this.siteLinks.shareLanding(this.link()))
  );

  /** Where the document's community page is, while it is published. */
  protected readonly communityUrl = computed(() =>
    this.siteLinks.communityDocument(this.kind, this.link())
  );

  /** The card the link unfurls as, absolute — an embed is pasted elsewhere. */
  protected readonly cardUrl = computed(() =>
    this.absolute(shareCardUrl(this.link()))
  );

  /**
   * An embed links to the community page while the document is published: it is
   * a link from somebody else's site, and the page that can rank is the one it
   * should carry. Unpublished, the share page is the only address there is.
   */
  protected readonly embedUrl = computed(() =>
    this.isPublic() ? this.absolute(this.communityUrl()) : this.shareUrl()
  );

  protected async copyLink(): Promise<void> {
    // The same rule the share controls use, so a refusal reads the same way
    // here as it does there.
    const copied = await copyText(this.shareUrl());
    this.toast.add({
      severity: copied ? 'success' : 'warn',
      summary: this.translation.translate(
        copied ? 'pages.my.share.copied' : 'pages.my.share.copyFailed'
      )
    });
  }

  /** Every URL this dialog shows is copied or pasted elsewhere. */
  private absolute(path: string): string {
    return `${this.origin}${path}`;
  }

  protected async setPublic(value: boolean): Promise<void> {
    if (this.pending() || value === this.isPublic()) return;

    const previous = this.isPublic();
    this.isPublic.set(value);
    await this.write('visibility', { public: value }, (updated) => {
      this.isPublic.set(updated.public);
      return { public: updated.public };
    }).catch(() => this.isPublic.set(previous));
  }

  protected async regenerate(): Promise<void> {
    if (this.pending()) return;

    await this.write('regenerate', { regenerateLink: true }, (updated) => {
      this.link.set(updated.link);
      return { link: updated.link };
    }).catch(() => undefined);
  }

  protected close(): void {
    this.dialogRef.close();
  }

  /**
   * One `PATCH`, applied to this dialog and to the shelf behind it. Rejects
   * after recording the failure, so a caller that optimistically moved a
   * control can put it back.
   */
  private async write(
    action: Exclude<PendingAction, null>,
    body: { public?: boolean; regenerateLink?: boolean },
    apply: (updated: { public: boolean; link: string }) => {
      public?: boolean;
      link?: string;
    }
  ): Promise<void> {
    this.pending.set(action);
    this.failureKey.set(null);
    try {
      const updated = await firstValueFrom(
        this.data.kind === 'projects'
          ? this.documentsApi.updateProject(this.data.id, body)
          : this.documentsApi.updateComponent(this.data.id, body)
      );
      this.documents.applyPatch(this.data.id, apply(updated));
    } catch (error) {
      this.failureKey.set(genericFailureKey(error));
      throw error;
    } finally {
      this.pending.set(null);
    }
  }
}
