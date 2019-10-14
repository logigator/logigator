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
		this.stateCompiler.compile(this.projectService.currProject).forEach(console.log);
		const start = Date.now();
		// for (let i = 0; i < 10000; i++) {
		// 	this.stateCompiler.compile(this.projectService.currProject);
		// }
		console.log(Date.now() - start);
		// this.projectService.currProject.stepBack();
	}

	public redo(): void {
		console.log(this.stateCompiler.wiresOnLinks.get(0));
		console.log(this.stateCompiler.wireEndsOnLinks.get(0));
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
