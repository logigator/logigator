import {Component, OnInit} from '@angular/core';
import {Project} from '../../models/project';
import {TestModel} from '../../models/tests/test-model';
import {ProjectState} from '../../models/project-state';
import * as PIXI from 'pixi.js';

@Component({
	selector: 'app-toolbar',
	templateUrl: './toolbar.component.html',
	styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent implements OnInit {

	private project: Project;

	ngOnInit() {
		this.project = new Project(new ProjectState(TestModel.basicModel));
		this.project.addComponent(2, new PIXI.Point(1, 2));
		this.project.addComponent(2, new PIXI.Point(1, 2));
		this.project.addComponent(2, new PIXI.Point(1, 2));
		this.project.addComponent(2, new PIXI.Point(1, 2));
		this.project.addComponent(2, new PIXI.Point(1, 2));
	}

	public test(): void {
		this.project.removeComponentById(Math.floor(Math.random() * this.project.currState.model.board.components.length));
		console.log(this.project.currState.model.board.components);
	}

	public undo(): void {
		this.project.stepBack();
		console.log(this.project.currState.model.board.components);
	}

	public redo(): void {
		this.project.stepForward();
		console.log(this.project.currState.model.board.components);
	}

}
