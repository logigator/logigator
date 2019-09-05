import {Component, OnInit} from '@angular/core';
import {Project} from '../../models/project';
import {TestModel} from '../../models/tests/test-model';
import {ProjectState} from '../../models/project-state';
import {WorkMode} from '../../models/work-modes';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import * as PIXI from 'pixi.js';

@Component({
	selector: 'app-toolbar',
	templateUrl: './toolbar.component.html',
	styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent implements OnInit {

	private project: Project;

	constructor(private workModeService: WorkModeService) { }

	ngOnInit() {
		this.project = new Project(new ProjectState(TestModel.basicModel));
	}

	public test(): void {
	}

	public test1(): void {
	}

	public setWorkMode(mode: WorkMode) {
		this.workModeService.setWorkMode(mode);
	}

	public get currentWorkMode(): WorkMode {
		return this.workModeService.currentWorkMode;
	}

	public undo(): void {
		this.project.stepBack();
	}

	public redo(): void {
		this.project.stepForward();
  }
}
