import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {ProjectsService} from "../../../services/projects/projects.service";

@Component({
	selector: 'app-edit-dropdown',
	templateUrl: './edit-dropdown.component.html',
	styleUrls: ['../top-bar-dropdowns.scss', './edit-dropdown.component.scss']
})
export class EditDropdownComponent implements OnInit {

	@Output()
	public requestClosed: EventEmitter<any> = new EventEmitter();

	constructor(private projectService: ProjectsService) { }

	ngOnInit() {
	}

	public close() {
		this.requestClosed.emit();
	}

	public undo() {
		this.projectService.currProject.stepBack();
		this.close();
	}

	public redo() {
		this.projectService.currProject.stepForward();
		this.close();
	}

	public copy() {
		this.close();
	}

	public paste() {
		this.close();
	}
}
