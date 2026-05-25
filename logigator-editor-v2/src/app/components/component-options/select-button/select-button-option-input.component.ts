import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TranslocoDirective } from '@jsverse/transloco';
import type { SelectButtonComponentOption } from './select-button.component-option';

let nextId = 0;

@Component({
	selector: 'app-select-button-option-input',
	imports: [
		FormsModule,
		SelectButtonModule,
		NgTemplateOutlet,
		TranslocoDirective
	],
	templateUrl: './select-button-option-input.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectButtonOptionInputComponent {
	public readonly option =
		input.required<SelectButtonComponentOption<unknown>>();
	protected readonly inputId = `component-settings-input-${++nextId}`;
}
