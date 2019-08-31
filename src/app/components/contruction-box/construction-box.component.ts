import {Component} from '@angular/core';
import {ComponentProviderService} from '../../services/component-provider/component-provider.service';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {WorkMode} from '../../models/work-modes';

@Component({
	selector: 'app-construction-box',
	templateUrl: './construction-box.component.html',
	styleUrls: ['./construction-box.component.scss']
})
export class ConstructionBoxComponent {

	public searchText = '';

	constructor(private componentProviderService: ComponentProviderService, private workModeService: WorkModeService) { }

	public get allAvailableComponents(): {id: number, name: string}[] {
		return this.componentProviderService.getAllComponents();
	}

	public availableComponentsTrackBy(index, item) {
		if (!item) return null;
		return item.id;
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
