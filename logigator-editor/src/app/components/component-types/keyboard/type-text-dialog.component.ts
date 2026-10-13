import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal
} from '@angular/core';
import { LgButton, LgDialogContent, LgTextarea } from '@logigator/ui';
import { TranslateDirective } from '../../../translation/translate.directive';
import { KEYBOARD_TEXT_LIMIT, textToCodes } from './ascii';

/**
 * Prepares a longer text for the keyboard, a program listing say, before it
 * goes out. The text is read as a paste is, and what that leaves out is
 * said before anything is sent. Closes with the codes to send as taps;
 * dismissing sends nothing.
 */
@Component({
  selector: 'app-type-text-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LgButton, LgTextarea, TranslateDirective],
  template: `
    <form
      *appTranslate="let t"
      class="flex flex-col gap-3"
      (submit)="send($event)"
    >
      <label for="type-text-field">
        {{ t('components.def.KEYBOARD.typeText.label') }}
      </label>
      <textarea
        lgTextarea
        id="type-text-field"
        rows="10"
        class="w-full resize-y font-mono text-sm"
        autocapitalize="off"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        [attr.maxlength]="limit"
        [value]="text()"
        (input)="onInput($event)"
      ></textarea>
      <div class="min-h-5 text-sm text-warn-text" aria-live="polite">
        @let skipped = result().skipped;
        @if (skipped.length === 1) {
          {{
            t('components.def.KEYBOARD.typeText.skippedOne', {
              char: skipped[0]
            })
          }}
        } @else if (skipped.length > 1) {
          {{
            t('components.def.KEYBOARD.typeText.skippedMany', {
              count: skipped.length
            })
          }}
        }
      </div>
      <div class="flex justify-end gap-2">
        <button
          lgButton
          severity="secondary"
          outlined
          (onClick)="dialogRef.close()"
        >
          {{ t('components.def.KEYBOARD.typeText.cancel') }}
        </button>
        <button lgButton type="submit" [disabled]="result().codes.length === 0">
          {{ t('components.def.KEYBOARD.typeText.send') }}
        </button>
      </div>
    </form>
  `
})
export class TypeTextDialogComponent extends LgDialogContent<
  void,
  readonly number[]
> {
  protected readonly limit = KEYBOARD_TEXT_LIMIT;
  protected readonly text = signal('');
  /** The text as it would be sent, recomputed as it is edited. */
  protected readonly result = computed(() => textToCodes(this.text()));

  protected onInput(e: Event): void {
    this.text.set((e.target as HTMLTextAreaElement).value);
  }

  protected send(e: Event): void {
    e.preventDefault();
    const { codes } = this.result();
    if (codes.length > 0) this.dialogRef.close(codes);
  }
}
