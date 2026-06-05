import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { TranslocoDirective } from '@jsverse/transloco';
import type { ComponentOptionInput } from '../../component-option';
import type { NumberComponentOption } from './number.component-option';

let nextId = 0;

@Component({
  selector: 'app-number-option-input',
  imports: [FormsModule, InputNumberModule, TranslocoDirective],
  templateUrl: './number-option-input.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NumberOptionInputComponent implements ComponentOptionInput<number> {
  public readonly option = input.required<NumberComponentOption>();
  public readonly commit = input.required<(value: number) => void>();
  protected readonly inputId = `component-settings-input-${++nextId}`;
}
