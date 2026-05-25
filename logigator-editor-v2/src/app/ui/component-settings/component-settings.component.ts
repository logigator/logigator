import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { ComponentOption } from '../../components/component-option';

@Component({
	selector: 'app-component-settings',
	imports: [NgComponentOutlet],
	templateUrl: './component-settings.component.html',
	styleUrl: './component-settings.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComponentSettingsComponent {
	public readonly config = input<ComponentOption[]>([]);
}
