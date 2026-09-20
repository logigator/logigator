import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input
} from '@angular/core';
import {
  LgTag,
  type LgDocumentVisibility,
  type LgSeverity
} from '@logigator/ui';
import { TranslationKey } from '../translation/translation-key.model';
import { TranslationService } from '../translation/translation.service';

/**
 * What this app calls each state, for every surface that names one: this chip,
 * and the share dialog's picker. A table rather than a chain of conditions, so
 * a state added to the union without a word here is a compile error rather than
 * a chip with nothing in it — and one table, so the chip and the control that
 * produces the state cannot come to say different things.
 */
export const VISIBILITY_LABELS: Record<LgDocumentVisibility, TranslationKey> = {
  private: 'visibility.private.label',
  unlisted: 'visibility.unlisted.label',
  public: 'visibility.public.label'
};

/**
 * How each state is tinted, here rather than at each surface that draws it: the
 * same state in green on one page and grey on another would read as two states.
 * Not a scale of danger — `secondary` is the muted treatment, the two states
 * that resolve for somebody else carry the tinted ones, and the listed one is
 * the settled one.
 */
const VISIBILITY_SEVERITIES: Record<LgDocumentVisibility, LgSeverity> = {
  private: 'secondary',
  unlisted: 'info',
  public: 'success'
};

/**
 * A document's state as one chip: the reader's own shelf draws it on every
 * tile, and a document's own page draws it wherever it is not public — which is
 * the only thing reconciling a link that resolves for nobody with an address
 * that looks like any other.
 */
@Component({
  selector: 'web-visibility-tag',
  imports: [LgTag],
  host: { class: 'inline-flex' },
  template: `<lg-tag [severity]="severity()" [value]="label()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VisibilityTag {
  private readonly translation = inject(TranslationService);

  readonly visibility = input.required<LgDocumentVisibility>();

  protected readonly label = computed(() =>
    this.translation.translate(VISIBILITY_LABELS[this.visibility()])
  );

  protected readonly severity = computed(
    () => VISIBILITY_SEVERITIES[this.visibility()]
  );
}
