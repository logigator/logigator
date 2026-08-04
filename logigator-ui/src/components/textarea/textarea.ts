import { booleanAttribute, Directive, computed, input } from '@angular/core';
import { formFieldClasses } from '../../tokens/form-field';
import { LgSize } from '../../tokens/size';

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
    formFieldClasses(this.size(), this.invalid())
  );
}
