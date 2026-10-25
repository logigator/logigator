import { Component, input, output } from '@angular/core';
import { LgButton } from '@logigator/ui';
import { TranslationKey } from '../../../translation/translation-key.model';
import { TranslateDirective } from '../../../translation/translate.directive';

let nextSummaryId = 0;

/**
 * The settings row of an option edited in a dialog: one full-width secondary
 * button asking for the dialog, the option's label at its start and an
 * optional summary of the value at its end. The label names the button and
 * the summary describes it; a summary that does not fit is cut short, the
 * label never. The dialog itself stays the option renderer's.
 */
@Component({
  selector: 'app-dialog-option-button',
  imports: [LgButton, TranslateDirective],
  template: `
    <button
      *appTranslate="let t"
      lgButton
      size="sm"
      severity="secondary"
      [icon]="icon()"
      class="w-full"
      [ariaLabel]="t(label())"
      [attr.aria-describedby]="summary() ? summaryId : null"
      (onClick)="open.emit()"
    >
      <span class="grow text-left">{{ t(label()) }}</span>
      <!-- The summary keeps the button's own text colour, whatever the
           theme and the hover state, and is set apart by weight: a lighter
           surface step falls below 4.5:1 on the light fill. -->
      @if (summary(); as summary) {
        <span [id]="summaryId" class="min-w-0 shrink-1000 truncate font-normal">
          {{ summary }}
        </span>
      }
    </button>
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

  protected readonly summaryId = `dialog-option-summary-${++nextSummaryId}`;
}
