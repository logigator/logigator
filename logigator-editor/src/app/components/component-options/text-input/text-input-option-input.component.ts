import { Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LgInputText } from '@logigator/ui';
import { TranslocoDirective } from '@jsverse/transloco';
import type { ComponentOptionInput } from '../../component-option';
import type { TextInputComponentOption } from './text-input.component-option';

let nextId = 0;

@Component({
  selector: 'app-text-input-option-input',
  imports: [FormsModule, LgInputText, TranslocoDirective],
  templateUrl: './text-input-option-input.component.html'
})
export class TextInputOptionInputComponent implements ComponentOptionInput<string> {
  public readonly option = input.required<TextInputComponentOption>();
  public readonly commit = input.required<(value: string) => void>();
  protected readonly inputId = `component-settings-input-${++nextId}`;
}
