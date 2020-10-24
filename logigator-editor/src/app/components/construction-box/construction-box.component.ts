import {Component} from '@angular/core';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';
import {ElementType} from '../../models/element-types/element-type';
import {ProjectsService} from '../../services/projects/projects.service';
import {ShortcutsService} from '../../services/shortcuts/shortcuts.service';

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

	public get basicComponents(): Map<number, ElementType> {
		return this.componentProviderService.basicElements;
	}

	public get advancedComponents(): Map<number, ElementType> {
		return this.componentProviderService.advancedElements;
	}

	public get plugComponents(): Map<number, ElementType> {
		return this.componentProviderService.plugElements;
	}

	public get ioComponents(): Map<number, ElementType> {
		return this.componentProviderService.ioElements;
	}

	public get userDefinedComponents(): Map<number, ElementType> {
		return this.componentProviderService.userDefinedElements;
	}

	public focusSearch() {
		this.shortcuts.disableShortcutListener();
	}

	public blurSearch() {
		this.shortcuts.enableShortcutListener();
	}
}
