import { Component, input, output } from '@angular/core';
import { LgButton } from '@logigator/ui';
import { TranslationKey } from '../../../translation/translation-key.model';
import { TranslateDirective } from '../../../translation/translate.directive';

/**
 * The settings row of an option edited in a dialog: one small secondary
 * button, right-aligned and named after the option, that asks for the dialog,
 * with an optional muted summary of the value at the row's start. The dialog
 * itself stays the option renderer's.
 */
@Component({
  selector: 'app-dialog-option-button',
  imports: [LgButton, TranslateDirective],
  template: `
    <div class="flex gap-4 items-center" *appTranslate="let t">
      @if (summary(); as summary) {
        <span class="text-sm text-muted">{{ summary }}</span>
      }
      <button
        lgButton
        class="ml-auto"
        [icon]="icon()"
        size="sm"
        severity="secondary"
        (onClick)="open.emit()"
      >
        {{ t(label()) }}
      </button>
    </div>
  `,
  host: { class: 'block' }
})
export class DialogOptionButtonComponent {
  public readonly label = input.required<TranslationKey>();
  /** A Phosphor icon class drawn before the label; none when omitted. */
  public readonly icon = input<string>();
  /** What the value holds, already translated; none when omitted or empty. */
  public readonly summary = input<string>();
  public readonly open = output<void>();
}
