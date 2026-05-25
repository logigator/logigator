import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
	inject
} from '@angular/core';
import { ComponentConfig } from '../../../components/component-config.model';
import { ButtonModule } from 'primeng/button';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { WorkModeService } from '../../../work-mode/work-mode.service';
import { WorkMode } from '../../../work-mode/work-mode.enum';

@Component({
	selector: 'app-component-list',
	imports: [ButtonModule, TranslocoDirective],
	templateUrl: './component-list.component.html',
	styleUrl: './component-list.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComponentListComponent {
	private readonly workModeService = inject(WorkModeService);
	private readonly translocoService = inject(TranslocoService);

	public headline = input<string>('');
	public components = input<ComponentConfig[]>([]);
	public searchText = input<string>('');

	protected filteredComponents = computed(() => {
		const search = this.searchText().trim().toLowerCase();
		if (!search) return this.components();
		return this.components().filter((comp) =>
			this.translocoService.translate(comp.name).toLowerCase().includes(search)
		);
	});

	protected selectedComponent = computed(() => {
		const selectedComponent = this.workModeService.selectedComponentType();
		if (selectedComponent === null) {
			return null;
		}

		return (
			this.filteredComponents().find((comp) => comp.type === selectedComponent)
				?.type ?? null
		);
	});

	public selectComponent(component: ComponentConfig): void {
		this.workModeService.setMode(WorkMode.COMPONENT_PLACEMENT);
		this.workModeService.setSelectedComponentType(component.type);
	}
}
