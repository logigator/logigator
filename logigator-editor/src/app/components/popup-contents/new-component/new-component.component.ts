import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {ProjectsService} from '../../../services/projects/projects.service';
import {ProjectSaveManagementService} from '../../../services/project-save-management/project-save-management.service';
import {EastereggService} from '../../../services/easteregg/easteregg.service';
import {PopupContentComp} from '@logigator/logigator-shared-comps';

@Component({
	selector: 'app-new-component',
	templateUrl: './new-component.component.html',
	styleUrls: ['./new-component.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewComponentComponent extends PopupContentComp implements OnInit {

	public newCompForm: FormGroup;

	constructor(
		private formBuilder: FormBuilder,
		private projects: ProjectsService,
		private saveManagement: ProjectSaveManagementService,
		private eastereggs: EastereggService) {
		super();
	}

	ngOnInit() {
		this.newCompForm = this.formBuilder.group({
			compName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(20), Validators.pattern('^.+$')]],
			compSymbol: ['', [Validators.required, Validators.maxLength(5), Validators.pattern('^.+$')]],
			compDescription: ['', [Validators.maxLength(1000)]]
		});
	}

	public async fromSubmitClick() {
		if (this.newCompForm.invalid) return;
		const id = await this.saveManagement.addCustomComponent(
			this.newCompForm.controls.compName.value,
			this.newCompForm.controls.compSymbol.value,
			this.newCompForm.controls.compDescription.value
		);
		this.requestClose.emit();
		this.projects.openComponent(id);
		const name = this.newCompForm.controls.compName.value.toLowerCase().replace(' ', '');
		if (name === 'asdf' || name === 'test') {
			this.eastereggs.achieve('LAZ');
		}
	}

}
