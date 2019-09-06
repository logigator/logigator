import {Component} from '@angular/core';
import {ElementProviderService} from '../../services/component-provider/element-provider.service';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {WorkMode} from '../../models/work-modes';
import {ElementType} from '../../models/element-type';

@Component({
	selector: 'app-construction-box',
	templateUrl: './construction-box.component.html',
	styleUrls: ['./construction-box.component.scss']
})
export class ConstructionBoxComponent {

	public searchText = '';

	constructor(private componentProviderService: ElementProviderService, private workModeService: WorkModeService) { }

	public get allAvailableComponents(): Map<number, ElementType> {
		return this.componentProviderService.getAllElements();
	}

	public availableComponentsTrackBy(index, item) {
		if (!item) return null;
		return item.key;
	}

	public selectComponent(id: number) {
		this.workModeService.setWorkMode('buildComponent', id);
	}

	public get currentWorkMode(): WorkMode {
		return this.workModeService.currentWorkMode;
	}

	public get currentSelectedComponent(): number {
		return this.workModeService.currentComponentToBuild;
	}
}
