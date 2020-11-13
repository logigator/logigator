import {Component} from '@angular/core';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';
import {ElementType} from '../../models/element-types/element-type';
import {ShortcutsService} from '../../services/shortcuts/shortcuts.service';
import {ProjectsService} from '../../services/projects/projects.service';

@Component({
	selector: 'app-construction-box',
	templateUrl: './construction-box.component.html',
	styleUrls: ['./construction-box.component.scss']
})
export class ConstructionBoxComponent {

	public searchText = '';

	constructor(
		private componentProviderService: ElementProviderService,
		private shortcuts: ShortcutsService,
		private projects: ProjectsService
	) { }

	public get showPlugComponents(): boolean {
		if (!this.projects.currProject) return false;
		return this.projects.currProject.type === 'comp';
	}

	public get basicComponents(): ElementType[] {
		return this.componentProviderService.basicElements;
	}

	public get advancedComponents(): ElementType[] {
		return this.componentProviderService.advancedElements;
	}

	public get plugComponents(): ElementType[] {
		return this.componentProviderService.plugElements;
	}

	public get ioComponents(): ElementType[] {
		return this.componentProviderService.ioElements;
	}

	public get userDefinedComponents(): ElementType[] {
		return this.componentProviderService.userDefinedElements;
	}

	public get localComponents(): ElementType[] {
		return this.componentProviderService.localElements;
	}

	public get sharedComponents(): ElementType[] {
		return this.componentProviderService.shareElements;
	}

	public focusSearch() {
		this.shortcuts.disableShortcutListener();
	}

	public blurSearch() {
		this.shortcuts.enableShortcutListener();
	}

	public reloadUserElements() {
	}
}
