import {Component as AngularComp, OnInit} from '@angular/core';
import {Project} from '../../models/project';
import {ComponentProviderService} from '../../services/component-provider/component-provider.service';
import {TestModel} from '../../models/tests/test-model';
import {ProjectState} from '../../models/project-state';
import {Action} from '../../models/action';
import {Component} from '../../models/component';
import {Chunk} from '../../models/chunk';

@AngularComp({
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

	public benchmark(): void {
		const start = Date.now();
		const arr: Chunk[] = [];
		for (let i = 0; i < 1e7; i++) {
			arr.push(undefined);
		}
		console.log(Date.now() - start);
	}

	public test(): void {
		this.project.addComponent(2, 5, 5);
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
