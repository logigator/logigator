import { Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LgInputNumber } from '@logigator/ui';
import type { ComponentOptionInput } from '../../component-option';
import type { NumberComponentOption } from './number.component-option';
import { TranslateDirective } from '../../../translation/translate.directive';

let nextId = 0;

@Component({
  selector: 'app-number-option-input',
  imports: [FormsModule, LgInputNumber, TranslateDirective],
  templateUrl: './number-option-input.component.html'
})
export class NumberOptionInputComponent implements ComponentOptionInput<number> {
  public readonly option = input.required<NumberComponentOption>();
  public readonly commit = input.required<(value: number) => void>();
  protected readonly inputId = `component-settings-input-${++nextId}`;
}
