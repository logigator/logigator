import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  canRotateLink,
  canShare,
  copyText,
  EMBED_FORMATS,
  embedSnippet,
  hasLiveLink,
  LgButton,
  LgDialogContent,
  LgIconField,
  LgInputIcon,
  LgInputText,
  LgMessage,
  LgSelectButton,
  LgTextarea,
  shareCardUrl,
  shareOrCopy,
  type LgDocumentVisibility,
  type LgEmbedFormat
} from '@logigator/ui';
import { isApiError } from '@logigator/contract';
import { TranslationService } from '../../../translation/translation.service';
import { TranslationKey } from '../../../translation/translation-key.model';
import { shareDocumentUrl } from './share-url';
import { ProjectApiService } from '../../../api/services/project-api.service';
import { ComponentApiService } from '../../../api/services/component-api.service';
import { ProjectMetadataStore } from '../../../persistence/project-metadata.store';
import { CustomComponentRegistry } from '../../../components/custom/custom-component-registry.service';
import { ToastService } from '../../../logging/toast.service';
import { AnalyticsService } from '../../../analytics/analytics.service';
import { AnalyticsEvent } from '../../../analytics/analytics.mapping';
import { TranslateDirective } from '../../../translation/translate.directive';
import { VisibilityPickerComponent } from '../../visibility-picker/visibility-picker.component';

/** The share-mutating subset both the project and component PATCH accept. */
interface ShareLinkPatch {
  visibility?: LgDocumentVisibility;
  regenerateLink?: boolean;
}

/** What a write answers with: the two fields either of them can move. */
interface ShareLinkSummary {
  link: string;
  visibility: LgDocumentVisibility;
}

/**
 * Which write is in flight. One flag per action rather than one for the dialog:
 * the two sit in different sections, and a shared flag would show the spinner
 * on the one nobody pressed.
 */
type PendingWrite = 'visibility' | 'regenerate' | null;

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
  visibility: LgDocumentVisibility;
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
 * Manages a cloud project's or custom component's share link: who it reaches,
 * the link itself, and the two actions that change them.
 *
 * **The picker writes as it is picked.** Its value is the document's the moment
 * it moves, so the link row, the embed and whether a rotation is offered all
 * change with it — which is the point: a reader picking "anyone with the link"
 * wants the URL there and then, not after a save and a reopen. What makes the
 * blind write safe is that the link does not move with the state: going private
 * and back hands out the same URL again, so every state change is a flag that
 * can be flipped back, and the one destructive action left is the rotation,
 * which has its own button and its own warning beside it.
 *
 * A picked state the server refuses is put back, and the refusal reported.
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
    TranslateDirective,
    VisibilityPickerComponent
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
  protected readonly embedding = signal(false);
  protected readonly format = signal<LgEmbedFormat>(EMBED_FORMATS[0]);

  /**
   * A refusal the reader has to read in place. The one write that can be
   * refused for a reason about the document rather than about the request is
   * the rotation, and the reason belongs beside the picker that just moved.
   */
  protected readonly failureKey = signal<TranslationKey | null>(null);

  /**
   * Which write the picker is waiting on, counting up. A pick is not held back
   * while another write is in flight, so the state a write answers with is only
   * applied where no later one has been made — see {@link setVisibility}.
   */
  private _writeSeq = 0;

  /**
   * Whether this browser has a sheet to open, which decides what the share
   * button does. Read directly rather than after a render, unlike the site's
   * copy of these controls: the editor is never server-rendered, so there is
   * no second render for the two to disagree with each other.
   */
  protected readonly hasSheet = canShare();

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
   * The page a link handed out lands on: the site's own page for the document,
   * in every state, which is what a recipient opens. The editor's own
   * `/share/{kind}/{link}` route is where that page sends a reader, not an
   * address to pass on. A `computed` over the active language rather than a
   * field: a URL captured once would keep the language the sharer has since
   * switched away from.
   */
  protected readonly shareUrl = computed(() =>
    shareDocumentUrl(this.translation.activeLang(), this.kind, this.link())
  );

  /** Absolute, because an embed is pasted onto somebody else's site. */
  protected readonly cardUrl = computed(
    () => `${window.location.origin}${shareCardUrl(this.kind, this.link())}`
  );

  protected readonly formatChoices = computed(() =>
    EMBED_FORMATS.map((format) => ({
      value: format,
      label: this.translation.translate(FORMAT_LABELS[format])
    }))
  );

  /**
   * The snippet names the document's page and nothing else: the page exists in
   * all three states, so there is no second address for a published document
   * to point at instead.
   */
  protected readonly embed = computed(() =>
    embedSnippet(this.format(), {
      url: this.shareUrl(),
      image: this.cardUrl(),
      title: this.name
    })
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
      const summary = await this._patch({ visibility: next });
      if (seq !== this._writeSeq) return;
      this._apply(summary, seq);
      this.toast.success(
        this.translation.translate('shareDialog.visibilityUpdated'),
        'ShareDialogComponent'
      );
    } catch (err) {
      if (seq !== this._writeSeq) return;
      this.visibility.set(previous);
      this.toast.error(
        this.translation.translate('shareDialog.visibilityFailed'),
        'ShareDialogComponent',
        err
      );
    } finally {
      if (seq === this._writeSeq) this.pending.set(null);
    }
  }

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

  /**
   * Issues a new link and hands it back, the old one dying with the request.
   *
   * **Immediate, deliberately not a field.** Rotation is the revocation the
   * whole capability model exists for, it is asked for by pressing a button
   * that says so, and the warning naming every URL it takes down sits right
   * under that button. A pending value would mean a reader could close the
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
   * intention, and `_apply` applies the link it answered with either way.
   */
  protected async regenerateLink(): Promise<void> {
    if (this.pending() || !this.canRegenerate()) return;

    this.pending.set('regenerate');
    this.failureKey.set(null);
    const seq = ++this._writeSeq;
    try {
      this._apply(await this._patch({ regenerateLink: true }), seq);
      this.analytics.capture(AnalyticsEvent.ShareLinkGenerated, {
        kind: this.kind
      });
      this.toast.success(
        this.translation.translate('shareDialog.linkRegenerated'),
        'ShareDialogComponent'
      );
    } catch (err) {
      if (isApiError(err, 'link_published')) {
        // The refusal is the answer to "is it still unpublished?": the document
        // was published from somewhere else since this dialog opened, so the
        // picker moves to where it actually is and stays there — the link does
        // not move with it, which is the whole point of the refusal. The
        // reason is drawn in the dialog rather than toasted: the reader is
        // looking at the picker that just changed under them, and the state it
        // landed on is precisely what the message explains.
        //
        // Unless a pick is newer, that is: its own answer is the last word on
        // the state, and moving the picker under it here would be this write
        // answering a question the reader has since asked again.
        if (seq === this._writeSeq) {
          this.visibility.set('public');
          this._persist({ visibility: 'public' });
        }
        this.failureKey.set('shareDialog.linkPublished');
        return;
      }
      this.toast.error(
        this.translation.translate('shareDialog.regenerateFailed'),
        'ShareDialogComponent',
        err
      );
    } finally {
      this.pending.set(null);
    }
  }

  /** PATCHes the project or component and resolves its `{ link, visibility }`. */
  private async _patch(body: ShareLinkPatch): Promise<ShareLinkSummary> {
    const summary =
      this.data.kind === 'project'
        ? await firstValueFrom(
            this.projectApi.update(this.data.projectId, body)
          )
        : await firstValueFrom(
            this.componentApi.update(this.data.componentId, body)
          );
    return { link: summary.link, visibility: summary.visibility };
  }

  /**
   * Applies what a write answered with, here and in the session. The answer is
   * the document's state by definition, so it is what the dialog is left
   * holding: a write asks for a state and the answer is the one the server
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
  private _apply(summary: ShareLinkSummary, seq: number): void {
    this.link.set(summary.link);
    this._persist({ link: summary.link });
    if (seq !== this._writeSeq) return;
    this.visibility.set(summary.visibility);
    this._persist({ visibility: summary.visibility });
  }

  /**
   * Writes a mutated link or visibility back into the session: for a component
   * onto its master definition, for a project onto the metadata store entry
   * addressed by id — a no-op when that project is not loaded.
   */
  private _persist(patch: {
    link?: string;
    visibility?: LgDocumentVisibility;
  }): void {
    if (this.data.kind === 'component') {
      this.registry.setMasterShareInfo(this.data.masterTypeId, patch);
      return;
    }
    const handle = this.metadataStore.getHandleById(this.data.projectId);
    if (handle) this.metadataStore.update(handle.project, patch);
  }

  /** The footer's one control, now that every write happens where it is made. */
  protected close(): void {
    this.dialogRef.close();
  }
}
