import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input
} from '@angular/core';
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
	public readonly config = input<Record<string, ComponentOption>>({});
	// Inspector-hidden options (e.g. a plug's system-managed `index`) still
	// round-trip through the wire format but are never rendered in the form.
	public readonly configEntries = computed(() =>
		Object.entries(this.config()).filter(
			([, option]) => !option.inspectorHidden
		)
	);
}
