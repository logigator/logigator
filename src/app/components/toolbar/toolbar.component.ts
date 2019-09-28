import {Component, OnInit} from '@angular/core';
import {WorkMode} from '../../models/work-modes';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {ProjectsService} from '../../services/projects/projects.service';
import {ProjectInteractionService} from '../../services/project-interaction/project-interaction.service';
import {Test} from '../../../../tests/auto-tests/tests';
import {ManuallyLogged} from '../../../../tests/auto-tests/logs';

@Component({
	selector: 'app-toolbar',
	templateUrl: './toolbar.component.html',
	styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent implements OnInit {

	private test: Test;

	constructor(
		private workModeService: WorkModeService,
		private projectService: ProjectsService,
		private projectInteraction: ProjectInteractionService
	) { }

	ngOnInit() {
	}

	public printElements(): void {
		this.projectService.currProject.allElements.forEach(console.log);
	}

	public printCalls(): void {
		console.log(this.projectService.currProject.log.stringify());
	}

	public runTests(): void {
		this.test = new Test('bugfix', this.projectService.currProject, ManuallyLogged.THECRASH);
		// for (const name in ManuallyLogged) {
		// 	Test.runAndCheck(name, false);
		// }
	}

	public runStep(): void {
		// for (let i = 0; i < 2000; i++) {
		this.test.runStep(true);
		// }
	}

	public setWorkMode(mode: WorkMode) {
		this.workModeService.setWorkMode(mode);
	}

	public get currentWorkMode(): WorkMode {
		return this.workModeService.currentWorkMode;
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
