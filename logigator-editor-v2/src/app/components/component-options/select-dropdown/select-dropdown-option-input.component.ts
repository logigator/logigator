import { Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LgSelect } from '@logigator/ui';
import { TranslocoDirective } from '@jsverse/transloco';
import type { ComponentOptionInput } from '../../component-option';
import type { SelectDropdownComponentOption } from './select-dropdown.component-option';

let nextId = 0;

@Component({
  selector: 'app-select-dropdown-option-input',
  imports: [FormsModule, LgSelect, TranslocoDirective],
  templateUrl: './select-dropdown-option-input.component.html'
})
export class SelectDropdownOptionInputComponent<
  T
> implements ComponentOptionInput<T> {
  public readonly option = input.required<SelectDropdownComponentOption<T>>();
  public readonly commit = input.required<(value: T) => void>();
  protected readonly inputId = `component-settings-input-${++nextId}`;
}
