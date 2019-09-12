import {Component, OnInit} from '@angular/core';
import {Project} from '../../models/project';
import {WorkMode} from '../../models/work-modes';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import * as PIXI from 'pixi.js';
import {ProjectsService} from '../../services/projects/projects.service';

@Component({
	selector: 'app-toolbar',
	templateUrl: './toolbar.component.html',
	styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent implements OnInit {

	constructor(private workModeService: WorkModeService, private projectService: ProjectsService) { }

	ngOnInit() {
	}

	public printElements(): void {
		console.log(this.projectService.currProject.allElements);
	}

	private printWires(): void {
		console.log('wires');
		for (const elem of this.projectService.currProject.allElements) {
			if (elem.typeId === 0) {
				console.log(elem.pos, elem.endPos);
			}
		}
	}

	public test(): void {
		this.projectService.currProject.connectWires(new PIXI.Point(51, 30));
	}

	public test1(): void {
		this.printWires();
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

}
