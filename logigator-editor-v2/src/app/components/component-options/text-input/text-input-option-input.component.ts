import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { TranslocoDirective } from '@jsverse/transloco';
import type { TextInputComponentOption } from './text-input.component-option';

let nextId = 0;

@Component({
	selector: 'app-text-input-option-input',
	imports: [FormsModule, InputTextModule, TranslocoDirective],
	templateUrl: './text-input-option-input.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TextInputOptionInputComponent {
	public readonly option = input.required<TextInputComponentOption>();
	protected readonly inputId = `component-settings-input-${++nextId}`;
}
