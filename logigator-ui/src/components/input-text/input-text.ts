import { booleanAttribute, Directive, computed, input } from '@angular/core';
import { formFieldClasses } from '../../tokens/form-field';
import { LgSize } from '../../tokens/size';

/**
 * Skins a native `<input>` with the shared form-field look. A directive, not a
 * component: it adds classes and nothing else, so value binding stays native
 * and works bare as well as with `ngModel` or reactive forms.
 *
 * Consumer classes merge onto the element — a template-static `class` wins
 * over the directive's host binding — so `class="w-full"` passes through.
 */
@Directive({
  selector: 'input[lgInputText]',
  host: { '[class]': 'classes()' }
})
export class LgInputText {
  readonly size = input<LgSize>();
  readonly invalid = input(false, { transform: booleanAttribute });

  protected readonly classes = computed(() =>
    formFieldClasses(this.size(), this.invalid())
  );
}
