import { Component, OnInit } from '@angular/core';
import {Project} from '../../models/project';
import {ComponentProviderService} from '../../services/component-provider/component-provider.service';
import {TestModel} from '../../models/tests/test-model';
import {ProjectState} from '../../models/project-state';
import {Action} from '../../models/action';

@Component({
	selector: 'app-toolbar',
	templateUrl: './toolbar.component.html',
	styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent implements OnInit {

	private project: Project;

	constructor(private compProvService: ComponentProviderService) { }

	ngOnInit() {
		this.project = new Project(this.compProvService, new ProjectState(this.compProvService, TestModel.basicModel));
		console.log('old: ', this.project.oldState.model.board.components);
		console.log('new: ', this.project.currState.model.board.components);
	}

	public test(): void {
		const action: Action = {
			objId: 2,
			name: 'addComp',
			posX: 5,
			posY: 5
		};
		this.project.newState(action);
		console.log('old: ', this.project.oldState.model.board.components);
		console.log('new: ', this.project.currState.model.board.components);
		// console.log(this.project.oldState.model.board.components.length, this.project.currState.model.board.components.length);
	}

	public undo(): void {
		this.project.stepBack();
		console.log('old: ', this.project.oldState.model.board.components);
		console.log('new: ', this.project.currState.model.board.components);
		// console.log(this.project.oldState.model.board.components.length, this.project.currState.model.board.components.length);
	}

	public redo(): void {
		this.project.stepForward();
		console.log('old: ', this.project.oldState.model.board.components);
		console.log('new: ', this.project.currState.model.board.components);
		// console.log(this.project.oldState.model.board.components.length, this.project.currState.model.board.components.length);
	}

}
