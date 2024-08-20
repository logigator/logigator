import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'app-component-settings',
	standalone: true,
	imports: [],
	templateUrl: './component-settings.component.html',
	styleUrl: './component-settings.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComponentSettingsComponent {}
