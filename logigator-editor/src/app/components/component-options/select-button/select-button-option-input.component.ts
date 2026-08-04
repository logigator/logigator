import { Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LgSelectButton } from '@logigator/ui';
import { TranslocoDirective } from '@jsverse/transloco';
import type { ComponentOptionInput } from '../../component-option';
import type { SelectButtonComponentOption } from './select-button.component-option';

let nextId = 0;

@Component({
  selector: 'app-select-button-option-input',
  imports: [FormsModule, LgSelectButton, TranslocoDirective],
  templateUrl: './select-button-option-input.component.html'
})
export class SelectButtonOptionInputComponent<
  T
> implements ComponentOptionInput<T> {
  public readonly option = input.required<SelectButtonComponentOption<T>>();
  public readonly commit = input.required<(value: T) => void>();
  // Labels the group by reference; see LgSelectButton's `ariaLabelledby`.
  protected readonly labelId = `component-settings-input-${++nextId}`;
}
