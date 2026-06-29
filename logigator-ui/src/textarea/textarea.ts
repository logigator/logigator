import { booleanAttribute, Directive, computed, input } from '@angular/core';
import {
  FORM_FIELD_BASE,
  FORM_FIELD_INVALID,
  FORM_FIELD_PADDING,
  FORM_FIELD_PADDING_SMALL
} from '../tokens/form-field';
import { LgSize } from '../tokens/size';

/**
 * Skins a native `<textarea>` with the shared form-field look — the multi-line
 * sibling of {@link LgInputText}. Value binding stays native (`[value]` or
 * `ngModel`); the consumer sets `rows` and any width class. No auto-resize.
 */
@Directive({
  selector: 'textarea[lgTextarea]',
  host: { '[class]': 'classes()' }
})
export class LgTextarea {
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
