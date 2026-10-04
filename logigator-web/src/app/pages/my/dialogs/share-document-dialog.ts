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
  canRotateLink,
  hasLiveLink,
  LG_DOCUMENT_VISIBILITIES,
  LgButton,
  LgDialogContent,
  LgIconField,
  LgInputIcon,
  LgInputText,
  LgMessage,
  LgSelectButton,
  type LgDocumentVisibility
} from '@logigator/ui';
import { isApiError } from '@logigator/contract';
import { shareCardUrl } from '../../../documents/crawler-image';
import { ShareControls } from '../../../documents/share-controls';
import {
  VISIBILITY_HINTS,
  VISIBILITY_LABELS
} from '../../../documents/visibility-tag';
import type { CommunityKind } from '../../../api/services/community-api.service';
import { DocumentsApiService } from '../../../api/services/documents-api.service';
import { genericFailureKey } from '../../../forms/api-failure';
import { SiteLinks } from '../../../layout/site-links';
import { apiKindOf } from '../../community/community-kind';
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
  visibility: LgDocumentVisibility;
}

/** The share-mutating subset both the project and component PATCH accept. */
interface ShareLinkPatch {
  visibility?: LgDocumentVisibility;
  regenerateLink?: boolean;
}

/** What a write answered with, which is everything either control changes. */
interface SharePatch {
  visibility: LgDocumentVisibility;
  link: string;
}

/** Which write is waiting on the API, not whether one is: the two buttons sit
 * in different sections, and a single flag would busy the one nobody pressed. */
type PendingWrite = 'visibility' | 'regenerate' | null;

/**
 * A document's share link, and who it reaches.
 *
 * The three states are one control rather than a switch, because they are not
 * degrees of one thing: `private` is a link that resolves for nobody, `unlisted`
 * a link that resolves for whoever holds it, and `public` a document in the
 * community listings whose page *is* that link.
 *
 * **The picker writes as it is picked.** Its value is the document's the moment
 * it moves, so the link row, the share controls and whether a rotation is
 * offered all change with it — which is the point: a reader picking "anyone
 * with the link" wants the URL there and then, not after a save and a reopen.
 * What makes the blind write safe is that the link does not move with the
 * state: going private and back hands out the same URL again, so every state
 * change is a flag that can be flipped back, and the one destructive action
 * left is the rotation, which has its own button and its own warning beside it.
 *
 * The one write that is not a pick is that rotation, which is immediate on
 * purpose — see {@link regenerate}.
 *
 * A write goes back into {@link MyDocumentsService} as its answer lands rather
 * than when the dialog closes: a rotation closes nothing, and the change is on
 * the server from that moment on, so the grid behind has to agree with it
 * whether the reader closes, dismisses, or picks again.
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
    LgSelectButton,
    ShareControls,
    TranslateDirective
  ],
  templateUrl: './share-document-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShareDocumentDialog extends LgDialogContent<ShareDocumentData> {
  private readonly documentsApi = inject(DocumentsApiService);
  private readonly documents = inject(MyDocumentsService);
  private readonly translation = inject(TranslationService);
  private readonly siteLinks = inject(SiteLinks);

  private readonly origin = inject(SITE_ORIGIN).replace(/\/+$/, '');

  private readonly data = this.dialogData!;

  protected readonly kind = this.data.kind;
  protected readonly name = this.data.name;

  /** The link the document answers on, as the server last reported it. */
  protected readonly link = signal(this.data.link);

  /**
   * The state the document is in, as this dialog has it. Optimistic: a pick
   * moves it before the write is answered and a refusal moves it back, so the
   * dialog holds either the state the server confirmed or the one it was
   * already in, never a third.
   */
  protected readonly visibility = signal<LgDocumentVisibility>(
    this.data.visibility
  );

  protected readonly pending = signal<PendingWrite>(null);

  /**
   * Why the last write was refused, where the reader is looking: a message
   * beside the control that moved beats a toast that leaves with it. The one
   * refusal that says more than "that did not work" is the rotation's, which
   * carries the state the document turned out to be in — see {@link fail}.
   */
  protected readonly failureKey = signal<TranslationKey | null>(null);

  /**
   * Which write the picker is waiting on, counting up. A pick is not held back
   * while another write is in flight, so the state a write answers with is only
   * applied where no later one has been made — see {@link setVisibility}.
   */
  private _writeSeq = 0;

  /**
   * The three states, in the order the shared rule holds them. A `computed`
   * for the reason the share controls' formats are one: `translate` reads the
   * active language, so a list built once would keep the words of a language
   * the reader has since left.
   */
  protected readonly states = computed(() =>
    LG_DOCUMENT_VISIBILITIES.map((visibility) => ({
      value: visibility,
      label: this.translation.translate(VISIBILITY_LABELS[visibility])
    }))
  );

  /** What the state the picker is on means, which is the document's too. */
  protected readonly stateHint = computed(() =>
    this.translation.translate(VISIBILITY_HINTS[this.visibility()])
  );

  /**
   * The page a link handed out lands on, which is what this dialog is for: one
   * URL in every state, so what the field shows is what the recipient opens.
   * The editor's own `/share/{kind}/{link}` route is where that page sends a
   * reader, not an address to pass on.
   */
  protected readonly shareUrl = computed(() =>
    this.absolute(this.siteLinks.communityDocument(this.kind, this.link()))
  );

  /** The card the link unfurls as, absolute — an embed is pasted elsewhere. */
  protected readonly cardUrl = computed(() =>
    this.absolute(shareCardUrl(apiKindOf(this.kind), this.link()))
  );

  /**
   * Whether the row below has a link to hand out at all. Drawn from the state
   * the picker is on, because the pick is the write: picking "anyone with the
   * link" is what makes the URL resolvable, and it is the same URL the document
   * has been keeping.
   */
  protected readonly hasLink = computed(() => hasLiveLink(this.visibility()));

  /** Whether a rotation is offered: only while unlisted, as the rule says. */
  protected readonly canRegenerate = computed(() =>
    canRotateLink(this.visibility())
  );

  /**
   * Writes the state the picker has just moved to.
   *
   * Optimistic on purpose. The panel under the picker is what the reader came
   * for, so picking "anyone with the link" hands out the URL there and then,
   * and nothing is risked by moving the picker first: the link does not move
   * with the state, so a refusal costs the one thing the dialog already has —
   * the state it was in, which is where the catch puts it back. A second pick
   * while the first write is in flight is not held back: the picker *is* the
   * state here, so a pick the dialog swallowed would leave the control showing
   * one the document is not in, and each write names the state it was picked
   * for rather than a difference from it, so nothing compounds.
   *
   * Overlapping writes are what the sequence number is for: a second pick makes
   * the first write's answer stale, and an answer that moved the picker back to
   * the state the *first* pick asked for — or put it back where it was because
   * that write failed — would show a state the document is not in.
   */
  protected async setVisibility(next: LgDocumentVisibility): Promise<void> {
    const previous = this.visibility();
    if (next === previous) return;

    this.visibility.set(next);
    this.pending.set('visibility');
    this.failureKey.set(null);
    const seq = ++this._writeSeq;
    try {
      const patch = await this.write({ visibility: next });
      if (seq !== this._writeSeq) return;
      this.apply(patch, seq);
    } catch (error) {
      if (seq !== this._writeSeq) return;
      this.visibility.set(previous);
      this.fail(error, seq);
    } finally {
      if (seq === this._writeSeq) this.pending.set(null);
    }
  }

  /**
   * Issues a new link and hands it back, the old one dying with the request.
   *
   * **Immediate, deliberately not a field.** Rotation is the revocation the
   * whole capability model exists for, it is asked for by pressing a button
   * that says so, and the warning naming every URL it takes down sits right
   * under that button. A pending value would mean a reader could dismiss the
   * dialog having rotated nothing while believing they had, so this stays the
   * one write that happens as it is asked for.
   *
   * Offered only while unlisted, which is what the button's own rule says
   * (`@logigator/ui`'s `canRotateLink`) and what the API enforces, a published
   * page's address being immovable. Private is deliberately not one of them:
   * the link is not shown there, so a rotation would be a button whose effect
   * nobody can see — it is one pick away, in the state that shows the URL and
   * replaces it, which is what the row above points at.
   *
   * Held back while another write is in flight, which no pick is: a rotation
   * answered with a state read before a pick landed would move the picker off
   * what the reader just chose. A pick made *during* the rotation is the newer
   * intention, and `apply` applies the link it answered with either way.
   */
  protected async regenerate(): Promise<void> {
    if (this.pending() || !this.canRegenerate()) return;

    this.pending.set('regenerate');
    this.failureKey.set(null);
    const seq = ++this._writeSeq;
    try {
      this.apply(await this.write({ regenerateLink: true }), seq);
    } catch (error) {
      this.fail(error, seq);
    } finally {
      this.pending.set(null);
    }
  }

  /** One `PATCH`, answered with the two fields either control can move. */
  private async write(body: ShareLinkPatch): Promise<SharePatch> {
    const updated = await firstValueFrom(
      this.data.kind === 'projects'
        ? this.documentsApi.updateProject(this.data.id, body)
        : this.documentsApi.updateComponent(this.data.id, body)
    );
    return { visibility: updated.visibility, link: updated.link };
  }

  /**
   * Applies what a write answered with, here and in the grid behind it. The
   * answer is the document's state by definition, so it is what the dialog is
   * left holding: a write asks for a state and the answer is the one the server
   * agreed to, which the picker moves to even where the request asked for
   * something else.
   *
   * The link lands whatever the state of the sequence. Only a rotation moves
   * it, so an answer carrying one is the newest word on it — and a reader whose
   * pick ran beside a rotation would otherwise be handed the address that
   * request just took down. The state is applied only for the newest write:
   * an older one answering late would move the picker off what the reader has
   * since chosen, or back onto it after a later pick failed.
   */
  private apply(patch: SharePatch, seq: number): void {
    this.link.set(patch.link);
    if (seq !== this._writeSeq) {
      // An older write answering late: the link it carries is still news, the
      // state it carries is not. Only a rotation moves the link, so this is the
      // one field such an answer can be trusted with.
      this.documents.applyPatch(this.data.id, { link: patch.link });
      return;
    }
    this.visibility.set(patch.visibility);
    this.documents.applyPatch(this.data.id, patch);
  }

  /**
   * Records why a write was refused, in the dialog rather than in a toast: the
   * reader is looking at the picker that just moved back, and the reason sits
   * beside it instead of leaving with a toast a few seconds later.
   *
   * One refusal says what the server refused *and* what the document is: a
   * document published from another tab since this dialog opened refuses the
   * rotation, and the answer to that is to show the state it is actually in
   * rather than the one the dialog was opened with — unless a pick is newer,
   * its own answer being the last word on the state.
   */
  private fail(error: unknown, seq: number): void {
    if (isApiError(error, 'link_published')) {
      // The refusal is the answer to "is it still unpublished?" — and the link
      // stays where it is, because the address never moved. That is the whole
      // point of the refusal.
      if (seq === this._writeSeq) {
        this.visibility.set('public');
        this.documents.applyPatch(this.data.id, { visibility: 'public' });
      }
      this.failureKey.set('pages.my.share.linkPublished');
      return;
    }
    this.failureKey.set(genericFailureKey(error));
  }

  /** Every URL this dialog shows is copied or pasted elsewhere. */
  private absolute(path: string): string {
    return `${this.origin}${path}`;
  }

  /** The footer's one control, now that every write happens where it is made. */
  protected close(): void {
    this.dialogRef.close();
  }
}
