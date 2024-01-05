import { Component } from '@angular/core';
import { ComponentConfig } from '../../classes/rendering/component';
import { ComponentProviderService } from '../../services/component-provider/component-provider.service';
import { ElementCategory } from '../../models/element/element-category';

@Component({
	selector: 'app-construction-box',
	templateUrl: './construction-box.component.html',
	styleUrls: ['./construction-box.component.scss']
})
export class ConstructionBoxComponent {
	public searchText = '';

	constructor(
		public readonly componentProviderService: ComponentProviderService
	) {}

	public get showPlugComponents(): boolean {
		// if (!this.projects.currProject) return false;
		// return this.projects.currProject.type === 'comp';
		return false;
	}

	public get basicComponents(): ComponentConfig[] {
		return this.componentProviderService.getElementsByCategory(
			ElementCategory.BASIC
		);
	}

	public get advancedComponents(): ComponentConfig[] {
		return this.componentProviderService.getElementsByCategory(
			ElementCategory.ADVANCED
		);
	}

	public get plugComponents(): ComponentConfig[] {
		return this.componentProviderService.getElementsByCategory(
			ElementCategory.CONNECTOR
		);
	}

	public get ioComponents(): ComponentConfig[] {
		return this.componentProviderService.getElementsByCategory(
			ElementCategory.IO
		);
	}

	public get userDefinedComponents(): ComponentConfig[] {
		return this.componentProviderService.getElementsByCategory(
			ElementCategory.USER
		);
	}

	public get localComponents(): ComponentConfig[] {
		// return this.componentProviderService.localElements;
		return [];
	}

	public get sharedComponents(): ComponentConfig[] {
		// return this.componentProviderService.shareElements;
		return [];
	}

	public focusSearch() {
		// this.shortcuts.disableShortcutListener();
	}

	public blurSearch() {
		// this.shortcuts.enableShortcutListener();
	}

	public reloadUserElements() {
		// this.projects.reloadUserElements();
	}
}
