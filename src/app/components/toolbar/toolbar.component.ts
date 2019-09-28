import {Component, OnInit} from '@angular/core';
import {WorkMode} from '../../models/work-modes';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {ProjectsService} from '../../services/projects/projects.service';
import {ProjectInteractionService} from '../../services/project-interaction/project-interaction.service';
import {NgForm} from '@angular/forms';

@Component({
	selector: 'app-toolbar',
	templateUrl: './toolbar.component.html',
	styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent implements OnInit {

	public newComponentPopup = false;

	constructor(
		private workModeService: WorkModeService,
		private projectService: ProjectsService,
		private projectInteraction: ProjectInteractionService
	) { }

	ngOnInit() {
	}

	public setWorkMode(mode: WorkMode) {
		this.workModeService.setWorkMode(mode);
	}

	public get currentWorkMode(): WorkMode {
		return this.workModeService.currentWorkMode;
	}

	public newComponent(form: NgForm): void {
		this.projectService.newComponent(form.form.value.name, form.form.value.symbol);
		this.newComponentPopup = false;
	}

	public undo(): void {
		this.projectService.currProject.stepBack();
	}

	public redo(): void {
		this.projectService.currProject.stepForward();
	}

	public zoomIn() {
		this.projectInteraction.zoomIn();
	}

	public zoomOut() {
		this.projectInteraction.zoomOut();
	}

	public delete() {
		this.projectInteraction.deleteSelection();
	}

	public copy() {
		this.projectInteraction.copySelection();
	}

	public cut() {
		this.projectInteraction.cutSelection();
	}

	public paste() {
		this.projectInteraction.paste();
	}

	public save() {
		this.projectService.saveAll();
	}
}
