import { booleanAttribute, Directive, computed, input } from '@angular/core';
import {
  FORM_FIELD_BASE,
  FORM_FIELD_INVALID,
  FORM_FIELD_PADDING,
  FORM_FIELD_PADDING_SMALL
} from '../tokens/form-field';
import { LgSize } from '../tokens/size';

/**
 * Skins a native `<input>` with the shared form-field look. A directive, not a
 * component: it adds classes and nothing else, so value binding stays native —
 * works **bare** (`[value]` + `(input)`/`(change)`) and with `ngModel`/reactive
 * forms (Angular's built-in value accessor handles the binding, exactly as
 * PrimeNG's `pInputText` does).
 *
 * Consumer classes merge onto the element (template-static `class` wins over the
 * directive's host binding), so `class="w-full"` and friends pass through.
 */
@Directive({
  selector: 'input[lgInputText]',
  host: { '[class]': 'classes()' }
})
export class LgInputText {
  readonly size = input<LgSize>();
  readonly invalid = input(false, { transform: booleanAttribute });

  protected readonly classes = computed(() =>
    [
      FORM_FIELD_BASE,
      this.size() === 'small' ? FORM_FIELD_PADDING_SMALL : FORM_FIELD_PADDING,
      this.invalid() ? FORM_FIELD_INVALID : ''
    ]
      .filter(Boolean)
      .join(' ')
  );
}
