import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  canShare,
  copyText,
  EMBED_FORMATS,
  embedSnippet,
  LgButton,
  LgSelectButton,
  LgTextarea,
  shareOrCopy,
  ToastService,
  type LgEmbedFormat
} from '@logigator/ui';
import { TranslateDirective } from '../translation/translate.directive';
import { TranslationKey } from '../translation/translation-key.model';
import { TranslationService } from '../translation/translation.service';

/**
 * The formats an embed can be pasted as, under the key each is named by. Proper
 * nouns, so the four locales say the same thing — but they come from the table
 * anyway, so a translator who needs them spelled otherwise can say so.
 */
const FORMAT_LABELS: Record<LgEmbedFormat, TranslationKey> = {
  markdown: 'share.formatMarkdown',
  html: 'share.formatHtml',
  bbcode: 'share.formatBbcode'
};

/**
 * Handing a document on: the browser's own sheet where there is one, the
 * clipboard where there is not, and the snippet that puts it on somebody else's
 * page.
 *
 * One component for the two surfaces that offer this — a document's own page
 * and the shelf dialog — because the rules behind them are shared
 * (`@logigator/ui`'s `share` and `embed` modules) and only the markup is
 * per-app. Every URL is absolute by contract: what is copied is pasted
 * elsewhere, where a path would resolve against somebody else's host.
 */
@Component({
  selector: 'web-share-controls',
  imports: [
    FormsModule,
    LgButton,
    LgSelectButton,
    LgTextarea,
    TranslateDirective
  ],
  templateUrl: './share-controls.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShareControls {
  private readonly toast = inject(ToastService);
  private readonly translation = inject(TranslationService);

  /**
   * What a recipient lands on, and what a snippet links to. One address, in
   * every state: a document's link *is* its page, so there is nothing an embed
   * could point at instead.
   */
  readonly url = input.required<string>();
  /** The composed card, which is the only render that survives being unfurled. */
  readonly image = input.required<string>();
  readonly title = input.required<string>();

  protected readonly embedding = signal(false);
  protected readonly format = signal<LgEmbedFormat>(EMBED_FORMATS[0]);

  /**
   * Whether this browser has a sheet to open, which decides both what the
   * button says and what it does.
   *
   * Read after the first paint rather than at construction: it is a
   * `navigator` question, and the server render has no `navigator` at all — so
   * a value fixed in the constructor would have the two renders disagree on
   * every phone, which is the one browser that has a sheet.
   */
  protected readonly hasSheet = signal(false);

  protected readonly formats = computed(() =>
    EMBED_FORMATS.map((format) => ({
      value: format,
      label: this.translation.translate(FORMAT_LABELS[format])
    }))
  );

  protected readonly embed = computed(() =>
    embedSnippet(this.format(), {
      url: this.url(),
      image: this.image(),
      title: this.title()
    })
  );

  constructor() {
    afterNextRender(() => this.hasSheet.set(canShare()));
  }

  /**
   * The sheet's own acknowledgement and a visitor closing it are both silent:
   * one needs no announcement, and the other is a choice rather than a failure.
   */
  protected async share(): Promise<void> {
    const outcome = await shareOrCopy({ title: this.title(), url: this.url() });

    if (outcome === 'copied') this.copied('share.copied');
    if (outcome === 'failed') this.failed('share.copyFailed');
  }

  protected async copyEmbed(): Promise<void> {
    if (await copyText(this.embed())) this.copied('share.embedCopied');
    else this.failed('share.embedCopyFailed');
  }

  /** The control hands back the option's own `value`, which `formats()` built. */
  protected selectFormat(format: LgEmbedFormat): void {
    this.format.set(format);
  }

  /**
   * A refusal is ordinary — an insecure origin, a permission the visitor
   * declined — so it is a note rather than an error, and the snippet sits in a
   * field they can select by hand.
   */
  private copied(key: TranslationKey): void {
    this.toast.add({
      severity: 'success',
      summary: this.translation.translate(key)
    });
  }

  private failed(key: TranslationKey): void {
    this.toast.add({
      severity: 'warn',
      summary: this.translation.translate(key)
    });
  }
}
