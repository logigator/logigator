import { Component, OnInit } from '@angular/core';
import {PopupContentComp} from '../popup-content-comp';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {ProjectsService} from '../../../../services/projects/projects.service';

@Component({
	selector: 'app-new-component',
	templateUrl: './new-component.component.html',
	styleUrls: ['./new-component.component.scss']
})
export class NewComponentComponent extends PopupContentComp implements OnInit {

	public newCompForm: FormGroup;

	constructor(private formBuilder: FormBuilder, private projects: ProjectsService) {
		super();
	}

	ngOnInit() {
		this.newCompForm = this.formBuilder.group({
			compName: ['', [Validators.required]],
			compSymbol: ['', [Validators.required]]
		});
	}

	public async fromSubmitClick() {
		if (this.newCompForm.invalid) return;
		await this.projects.newComponent(this.newCompForm.controls.compName.value, this.newCompForm.controls.compSymbol.value);
		this.requestClose.emit();
	}

}
