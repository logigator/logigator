import { Component, OnInit } from '@angular/core';
import {SelectionService} from '../../services/selection/selection.service';
import {ProjectsService} from '../../services/projects/projects.service';

@Component({
	selector: 'app-status-bar',
	templateUrl: './status-bar.component.html',
	styleUrls: ['./status-bar.component.scss']
})
export class StatusBarComponent {

	constructor(
		private selectionService: SelectionService,
		private projectsService: ProjectsService
	) {}

	public get selected(): number {
		return this.selectionService.selectedIds().length;
	}

	public get isSaved(): boolean {
		if (!this.projectsService.currProject) return true;
		return !this.projectsService.currProject.saveDirty;
	}
}


