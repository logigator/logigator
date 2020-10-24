import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {ProjectSaveManagementService} from '../../../services/project-save-management/project-save-management.service';
import {Project} from '../../../models/project';
import {UserService} from '../../../services/user/user.service';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {PopupContentComp} from '../../popup/popup-content-comp';

@Component({
	selector: 'app-save-as',
	templateUrl: './save-as.component.html',
	styleUrls: ['./save-as.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SaveAsComponent extends PopupContentComp<Project> implements OnInit {

	public saveForm: FormGroup;

	constructor(
		private projectSaveManagement: ProjectSaveManagementService,
		private user: UserService,
		private formBuilder: FormBuilder
	) {
		super();
	}

	ngOnInit() {
		this.saveForm = this.formBuilder.group({
			name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(20), Validators.pattern('^.+$')]],
			description: ['', [Validators.maxLength(1000)]]
		});
	}

	public get isLoggedIn(): boolean {
		return this.user.isLoggedIn;
	}

	public async saveToServer() {
		// const newProject = this.projectSaveManagement.saveAsNewProjectServer(
		// 	this.inputFromOpener, this.saveForm.controls.name.value, this.saveForm.controls.description.value
		// );
		// this.requestClose.emit(newProject);
	}

	public exportProject() {
		// this.projectSaveManagement.exportToFile(this.inputFromOpener, this.saveForm.controls.name.value);
	}

}
