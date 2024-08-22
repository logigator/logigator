import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ComponentOption } from '../../components/component-option';
import { InputNumberModule } from 'primeng/inputnumber';
import { FormsModule } from '@angular/forms';
import { NumberComponentOption } from '../../components/component-options/number.component-option';
import { SelectComponentOption } from '../../components/component-options/select.component-option';
import { SelectButtonModule } from 'primeng/selectbutton';
import { DropdownModule } from 'primeng/dropdown';
import { NgTemplateOutlet } from '@angular/common';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
	selector: 'app-component-settings',
	standalone: true,
	imports: [
		InputNumberModule,
		FormsModule,
		SelectButtonModule,
		DropdownModule,
		NgTemplateOutlet,
		TranslocoDirective
	],
	templateUrl: './component-settings.component.html',
	styleUrl: './component-settings.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComponentSettingsComponent {
	public readonly config = input<ComponentOption[]>([]);

	constructor() {}

	protected isNumberInput(
		option: ComponentOption
	): option is NumberComponentOption {
		return option instanceof NumberComponentOption;
	}

	protected isSelectInput(
		option: ComponentOption
	): option is SelectComponentOption<unknown> {
		return option instanceof SelectComponentOption;
	}
}
