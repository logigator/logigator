import { Component, OnInit } from '@angular/core';
import {PopupContentComp} from '../popup-content-comp';
import {ProjectSaveManagementService} from '../../../../services/project-save-management/project-save-management.service';
import {Project} from '../../../../models/project';
import {UserService} from '../../../../services/user/user.service';
import {FormControl, Validators} from '@angular/forms';

@Component({
	selector: 'app-save-as',
	templateUrl: './save-as.component.html',
	styleUrls: ['./save-as.component.scss']
})
export class SaveAsComponent extends PopupContentComp<Project> implements OnInit {

	public projectName: FormControl;

	constructor(private projectSaveManagement: ProjectSaveManagementService, private user: UserService) {
		super();
	}

	ngOnInit() {
		this.projectName = new FormControl(this.inputFromOpener.name, [
			Validators.required, Validators.minLength(2), Validators.maxLength(20), Validators.pattern('^[a-zA-Z0-9_\\- ]+$')
		]);
	}

	public get isLoggedIn(): boolean {
		return this.user.isLoggedIn;
	}

	public async saveToServer() {
		const newProject = this.projectSaveManagement.saveAsNewProjectServer(this.inputFromOpener, this.projectName.value);
		this.requestClose.emit(newProject);
	}

	public exportProject() {
		this.projectSaveManagement.exportToFile(this.inputFromOpener, this.projectName.value);
	}

}
