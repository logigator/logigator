import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { SelectModule } from 'primeng/select';
import { TranslocoDirective } from '@jsverse/transloco';
import type { SelectDropdownComponentOption } from './select-dropdown.component-option';

let nextId = 0;

@Component({
	selector: 'app-select-dropdown-option-input',
	imports: [FormsModule, SelectModule, NgTemplateOutlet, TranslocoDirective],
	templateUrl: './select-dropdown-option-input.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectDropdownOptionInputComponent {
	public readonly option =
		input.required<SelectDropdownComponentOption<unknown>>();
	protected readonly inputId = `component-settings-input-${++nextId}`;
}
