import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input
} from '@angular/core';
import { ComponentConfig } from '../../../components/component-config.model';
import { ButtonModule } from 'primeng/button';
import { LoggingService } from '../../../logging/logging.service';
import { TranslocoDirective } from '@jsverse/transloco';
import { WorkModeService } from '../../../work-mode/work-mode.service';
import { WorkMode } from '../../../work-mode/work-mode.enum';

@Component({
	selector: 'app-component-list',
	standalone: true,
	imports: [ButtonModule, TranslocoDirective],
	templateUrl: './component-list.component.html',
	styleUrl: './component-list.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComponentListComponent {
	public headline = input<string>('');
	public components = input<ComponentConfig[]>([]);
	public searchText = input<string>('');

	protected selectedComponent = computed(() => {
		const selectedComponent = this.workModeService.selectedComponentType();
		if (selectedComponent === null) {
			return null;
		}

		return (
			this.components().find((comp) => comp.type === selectedComponent)?.type ??
			null
		);
	});

	constructor(
		private readonly loggingService: LoggingService,
		private readonly workModeService: WorkModeService
	) {}

	public selectComponent(component: ComponentConfig): void {
		this.loggingService.log(component, 'ComponentListComponent');
		this.workModeService.setMode(WorkMode.COMPONENT_PLACEMENT);
		this.workModeService.setSelectedComponentType(component.type);
	}
}
