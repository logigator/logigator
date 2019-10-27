import { Component, OnInit } from '@angular/core';
import {PopupContentComp} from '../popup-content-comp';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {ProjectsService} from '../../../../services/projects/projects.service';
import {ProjectSaveManagementService} from '../../../../services/project-save-management/project-save-management.service';

@Component({
	selector: 'app-new-component',
	templateUrl: './new-component.component.html',
	styleUrls: ['./new-component.component.scss']
})
export class NewComponentComponent extends PopupContentComp implements OnInit {

	public newCompForm: FormGroup;

	constructor(private formBuilder: FormBuilder, private projects: ProjectsService, private saveManagement: ProjectSaveManagementService) {
		super();
	}

	ngOnInit() {
		this.newCompForm = this.formBuilder.group({
			compName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(20), Validators.pattern('^[a-zA-Z0-9_\\- ]+$')]],
			compSymbol: ['', [Validators.required, Validators.maxLength(5), Validators.pattern('^[a-zA-Z0-9_\\-]+$')]]
		});
	}

	public fromSubmitClick() {
		if (this.newCompForm.invalid) return;
		this.saveManagement.addCustomComponent(this.newCompForm.controls.compName.value, this.newCompForm.controls.compSymbol.value);
		this.requestClose.emit();
	}

}
