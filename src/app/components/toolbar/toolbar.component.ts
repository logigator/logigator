import {Component, OnInit} from '@angular/core';
import {WorkMode} from '../../models/work-modes';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {ProjectsService} from '../../services/projects/projects.service';
import {ProjectInteractionService} from '../../services/project-interaction/project-interaction.service';
import {StateCompilerService} from '../../services/simulation/state-compiler/state-compiler.service';

@Component({
	selector: 'app-toolbar',
	templateUrl: './toolbar.component.html',
	styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent implements OnInit {

	constructor(
		private workModeService: WorkModeService,
		private projectService: ProjectsService,
		private projectInteraction: ProjectInteractionService,
		private stateCompiler: StateCompilerService
	) { }

	ngOnInit() {
	}

	public setWorkMode(mode: WorkMode) {
		this.workModeService.setWorkMode(mode);
	}

	public get currentWorkMode(): WorkMode {
		return this.workModeService.currentWorkMode;
	}

	public undo(): void {
		console.log('~~~~');
		this.stateCompiler.compile(this.projectService.currProject.currState).forEach(console.log);
		const start = Date.now();
		// for (let i = 0; i < 10000; i++) {
		// 	this.stateCompiler.compile(this.projectService.currProject.currState);
		// }
		console.log(Date.now() - start);
		// this.projectService.currProject.stepBack();
	}

	public redo(): void {
		const test0 = [0, 1, 2];
		const test1 = [3, 4, 5];
		const all = test0.concat(test1);
		all[2] = 20;
		console.log(all, test0, test1);
		return;
		console.log(this.projectService.currProject.allElements);
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
