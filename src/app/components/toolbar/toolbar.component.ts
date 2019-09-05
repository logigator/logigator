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
	}

	public test(): void {
		this.project.addComponent(2, new PIXI.Point(1, 2));
		console.log(this.project.currState.model.board.components);
	}

	public test1(): void {
		this.project.removeComponentById(Math.floor(Math.random() * this.project.currState.model.board.components.length));
		console.log(this.project.currState.model.board.components);
	}

	public undo(): void {
		console.log(this.project.stepBack());
		console.log(this.project.currState.model.board.components);
	}

	public redo(): void {
		console.log(this.project.stepForward());
		console.log(this.project.currState.model.board.components);
	}

}
