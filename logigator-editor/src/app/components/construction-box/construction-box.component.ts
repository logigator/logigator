import { Component } from '@angular/core';
import { ElementType } from '../../models/element-types/element-type';

@Component({
	selector: 'app-construction-box',
	templateUrl: './construction-box.component.html',
	styleUrls: ['./construction-box.component.scss']
})
export class ConstructionBoxComponent {
	public searchText = '';

	constructor(
	) {}

	public get showPlugComponents(): boolean {
		// if (!this.projects.currProject) return false;
		// return this.projects.currProject.type === 'comp';
		return false;
	}

	public get basicComponents(): ElementType[] {
		// return this.componentProviderService.basicElements;
		return [];
	}

	public get advancedComponents(): ElementType[] {
		// return this.componentProviderService.advancedElements;
		return [];
	}

	public get plugComponents(): ElementType[] {
		// return this.componentProviderService.plugElements;
		return [];
	}

	public get ioComponents(): ElementType[] {
		// return this.componentProviderService.ioElements;
		return [];
	}

	public get userDefinedComponents(): ElementType[] {
		// return this.componentProviderService.userDefinedElements;
		return [];
	}

	public get localComponents(): ElementType[] {
		// return this.componentProviderService.localElements;
		return [];
	}

	public get sharedComponents(): ElementType[] {
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
