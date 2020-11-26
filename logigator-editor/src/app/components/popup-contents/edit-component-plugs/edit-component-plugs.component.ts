import {Component, OnInit} from '@angular/core';
import {PopupContentComp} from '../../popup/popup-content-comp';
import {Project} from '../../../models/project';
import {AbstractControl, FormArray, FormBuilder, FormGroup} from '@angular/forms';

@Component({
	selector: 'app-edit-component-plugs',
	templateUrl: './edit-component-plugs.component.html',
	styleUrls: ['./edit-component-plugs.component.scss']
})
export class EditComponentPlugsComponent extends PopupContentComp<Project, never> implements OnInit {

	public inputLabelsForm: FormGroup;
	public outputLabelsForm: FormGroup;

	constructor(private formBuilder: FormBuilder) {
		super();
	}

	ngOnInit(): void {
		const plugs = this.inputFromOpener.currState.allPlugs();
		const inputPlugs = plugs.slice(0, this.inputFromOpener.numInputs);
		const outputPlugs = plugs.slice(this.inputFromOpener.numInputs);

		this.inputLabelsForm = this.formBuilder.group({
			labels: this.formBuilder.array(inputPlugs.map(p => this.formBuilder.control(p.data ?? 'IN')))
		});
		this.outputLabelsForm = this.formBuilder.group({
			labels: this.formBuilder.array(outputPlugs.map(p => this.formBuilder.control(p.data ?? 'OUT')))
		});
	}

	public get inputLabelsControls(): AbstractControl[] {
		return (this.inputLabelsForm.controls.labels as FormArray).controls;
	}

	public get outputLabelsControls(): AbstractControl[] {
		return (this.outputLabelsForm.controls.labels as FormArray).controls;
	}

	public save() {

	}

}
