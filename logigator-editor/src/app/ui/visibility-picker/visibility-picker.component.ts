import { Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LG_DOCUMENT_VISIBILITIES,
  LgSelectButton,
  type LgDocumentVisibility
} from '@logigator/ui';
import { TranslationService } from '../../translation/translation.service';
import { TranslationKey } from '../../translation/translation-key.model';

/**
 * What this app calls each state, and what it means for whoever holds the link.
 * A table rather than a chain of conditions, so a state added to the union
 * without a word here is a compile error rather than a segment with nothing in
 * it — and one table, so the four dialogs that draw this control cannot come to
 * name the same state differently.
 */
const VISIBILITY_LABELS: Record<LgDocumentVisibility, TranslationKey> = {
  private: 'visibility.private.label',
  unlisted: 'visibility.unlisted.label',
  public: 'visibility.public.label'
};

const VISIBILITY_HINTS: Record<LgDocumentVisibility, TranslationKey> = {
  private: 'visibility.private.hint',
  unlisted: 'visibility.unlisted.hint',
  public: 'visibility.public.hint'
};

/**
 * Who can open a document — one control, drawn by the share dialog and by all
 * three dialogs that create a cloud document.
 *
 * The three states rather than a switch, because they are not degrees of one
 * thing: `private` is a link that resolves for nobody, `unlisted` a link that
 * resolves for whoever holds it, `public` a document in the community listings
 * whose page *is* that link. The order is `@logigator/ui`'s
 * `LG_DOCUMENT_VISIBILITIES`, and the hint under the control is the state the
 * control is on — a segment labelled "Everyone" says nothing about what
 * everybody gets, which is what the readers of this dialog are actually
 * deciding.
 *
 * Stateless: the state it shows is the caller's, and picking one is only
 * reported. Every caller holds that state itself — a dialog that creates a
 * document writes the picker's value on Save, and the share dialog writes each
 * pick as it is made and puts it back when the server refuses it — so the value
 * cannot live here.
 *
 * Drawn at the `sm` step rather than the default one, because these labels are
 * sentences: in French — the longest of the four locales — the three segments
 * measure 488px at `md` against the 464px of track a 32rem dialog leaves, so
 * they would need a second row to be read at all. At `sm` they measure 437px
 * and one row holds. A narrower dialog still breaks between segments rather
 * than inside them, which is the library's own behaviour.
 */
@Component({
  selector: 'app-visibility-picker',
  imports: [FormsModule, LgSelectButton],
  host: { class: 'contents' },
  template: `
    <div class="flex flex-col gap-2">
      <lg-select-button
        fluid
        size="sm"
        optionLabel="label"
        optionValue="value"
        [allowEmpty]="false"
        [ariaLabelledby]="labelledby()"
        [options]="states()"
        [ngModel]="visibility()"
        [ngModelOptions]="{ standalone: true }"
        (ngModelChange)="visibilityChange.emit($event)"
      />
      <!-- The hint is drawn here rather than by the dialog, and the site's
           share dialog draws its own against these same classes at the same
           distance: the two pickers are one control in two apps, and the words
           are all that differ, each app translating its own. -->
      <p class="text-sm leading-relaxed text-muted">{{ stateHint() }}</p>
    </div>
  `
})
export class VisibilityPickerComponent {
  private readonly translation = inject(TranslationService);

  /** Ids the caption the dialog draws above this control. */
  readonly labelledby = input<string>();

  readonly visibility = input.required<LgDocumentVisibility>();
  readonly visibilityChange = output<LgDocumentVisibility>();

  /**
   * A `computed` over the active language rather than a field: a list built
   * once would keep the words of a language the reader has since switched away
   * from, which is the trap every translated list in this app avoids.
   */
  protected readonly states = computed(() =>
    LG_DOCUMENT_VISIBILITIES.map((visibility) => ({
      value: visibility,
      label: this.translation.translate(VISIBILITY_LABELS[visibility])
    }))
  );

  protected readonly stateHint = computed(() =>
    this.translation.translate(VISIBILITY_HINTS[this.visibility()])
  );
}
