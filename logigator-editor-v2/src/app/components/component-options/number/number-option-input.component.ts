import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { TranslocoDirective } from '@jsverse/transloco';
import type { NumberComponentOption } from './number.component-option';

let nextId = 0;

@Component({
	selector: 'app-number-option-input',
	imports: [FormsModule, InputNumberModule, TranslocoDirective],
	templateUrl: './number-option-input.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class NumberOptionInputComponent {
	public readonly option = input.required<NumberComponentOption>();
	protected readonly inputId = `component-settings-input-${++nextId}`;
}
