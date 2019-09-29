import { Component, OnInit } from '@angular/core';
import {PopupContentComp} from '../popup-content-comp';
import {ProjectsService} from '../../../../services/projects/projects.service';

@Component({
	selector: 'app-open-project',
	templateUrl: './open-project.component.html',
	styleUrls: ['./open-project.component.scss']
})
export class OpenProjectComponent extends PopupContentComp implements OnInit {

	constructor(private projects: ProjectsService) {
		super();
	}

	ngOnInit() {
	}

	public openFile() {
		this.projects.openFile();
		this.requestClose.emit();
	}

}
