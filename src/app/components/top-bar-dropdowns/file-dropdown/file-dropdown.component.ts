import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {ProjectsService} from '../../../services/projects/projects.service';

@Component({
	selector: 'app-file-dropdown',
	templateUrl: './file-dropdown.component.html',
	styleUrls: ['../top-bar-dropdowns.scss', './file-dropdown.component.scss']
})
export class FileDropdownComponent implements OnInit {

	@Output()
	public requestClosed: EventEmitter<any> = new EventEmitter();

	constructor(private projectsService: ProjectsService) { }

	ngOnInit() {
	}

	public close() {
		this.requestClosed.emit();
	}

	public newProject() {
		this.close();
	}

	public newComponent() {
		this.close();
	}

	public openProject() {
		this.close();
	}

	public saveProject() {
		this.close();
	}

	public screenshot() {
		this.close();
	}
}
