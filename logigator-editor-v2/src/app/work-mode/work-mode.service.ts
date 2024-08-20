import { computed, Injectable, signal } from '@angular/core';
import { WorkMode } from './work-mode.enum';
import { ComponentType } from '../components/component-type.enum';
import { ComponentProviderService } from '../components/component-provider.service';

@Injectable({
	providedIn: 'root'
})
export class WorkModeService {
	private readonly _mode = signal<WorkMode>(WorkMode.WIRE_DRAWING);
	public readonly mode = computed(this._mode);

	private readonly _selectedComponentType = signal<ComponentType | null>(null);
	public readonly selectedComponentType = computed(this._selectedComponentType);

	constructor(
		private readonly componentProviderService: ComponentProviderService
	) {}

	public setMode(mode: WorkMode): void {
		if (mode !== WorkMode.COMPONENT_PLACEMENT) {
			this.setSelectedComponentType(null);
		}

		this._mode.set(mode);
	}

	public setSelectedComponentType(componentType: ComponentType | null): void {
		this._selectedComponentType.set(componentType);
	}
}
