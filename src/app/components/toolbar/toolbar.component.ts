import {Component, OnInit} from '@angular/core';
import {Project} from '../../models/project';
import {TestModel} from '../../models/tests/test-model';
import {ProjectState} from '../../models/project-state';

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
	}

	public undo(): void {
		this.project.stepBack();
	}

	public redo(): void {
		this.project.stepForward();
	}

}
