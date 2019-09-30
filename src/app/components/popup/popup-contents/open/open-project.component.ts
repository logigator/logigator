import { Component, OnInit } from '@angular/core';
import {PopupContentComp} from '../popup-content-comp';
import {ProjectsService} from '../../../../services/projects/projects.service';
import {FormBuilder, FormGroup} from '@angular/forms';

@Component({
	selector: 'app-open-project',
	templateUrl: './open-project.component.html',
	styleUrls: ['./open-project.component.scss']
})
export class OpenProjectComponent extends PopupContentComp implements OnInit {

	public fileToOpen: File;

	constructor(private projects: ProjectsService, private formBuilder: FormBuilder) {
		super();
	}

	ngOnInit() {
	}

	public inputFileChanged(event) {
		this.fileToOpen = event.target.files[0];
	}

	public openFile() {
		const reader = new FileReader();
		reader.readAsText(this.fileToOpen, 'UTF-8');
		reader.onload = (event: any) => {
			this.projects.openFile(event.target.result);
			this.requestClose.emit();
		};
	}

}
