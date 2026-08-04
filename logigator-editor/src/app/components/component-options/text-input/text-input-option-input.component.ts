import { Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LgInputText } from '@logigator/ui';
import type { ComponentOptionInput } from '../../component-option';
import type { TextInputComponentOption } from './text-input.component-option';
import { TranslateDirective } from '../../../translation/translate.directive';

let nextId = 0;

@Component({
  selector: 'app-text-input-option-input',
  imports: [FormsModule, LgInputText, TranslateDirective],
  templateUrl: './text-input-option-input.component.html'
})
export class TextInputOptionInputComponent implements ComponentOptionInput<string> {
  public readonly option = input.required<TextInputComponentOption>();
  public readonly commit = input.required<(value: string) => void>();
  protected readonly inputId = `component-settings-input-${++nextId}`;
}
