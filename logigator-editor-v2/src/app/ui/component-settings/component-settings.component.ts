import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { WorkModeService } from '../../work-mode/work-mode.service';

@Component({
	selector: 'app-component-settings',
	standalone: true,
	imports: [],
	templateUrl: './component-settings.component.html',
	styleUrl: './component-settings.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComponentSettingsComponent {
	protected config = computed(() => {
		this.workModeService.selectedComponentConfig();
	})

	constructor(
		private readonly workModeService: WorkModeService
	) {}
}
