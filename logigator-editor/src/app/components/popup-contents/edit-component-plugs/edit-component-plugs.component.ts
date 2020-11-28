import {Component, OnInit} from '@angular/core';
import {PopupContentComp} from '../../popup/popup-content-comp';
import {Project} from '../../../models/project';
import {AbstractControl, FormArray, FormBuilder, FormGroup} from '@angular/forms';
import {ProjectsService} from '../../../services/projects/projects.service';
import {Element} from '../../../models/element';

@Component({
	selector: 'app-edit-component-plugs',
	templateUrl: './edit-component-plugs.component.html',
	styleUrls: ['./edit-component-plugs.component.scss']
})
export class EditComponentPlugsComponent extends PopupContentComp<Project, never> implements OnInit {

	public inputLabelsForm: FormGroup;
	public outputLabelsForm: FormGroup;

	private _inputPlugs: Element[];
	private _outputPlugs: Element[];

	constructor(private formBuilder: FormBuilder, private projectsService: ProjectsService) {
		super();
	}

	ngOnInit(): void {
		const plugs = this.inputFromOpener.currState.allPlugs();
		this._inputPlugs = plugs.slice(0, this.inputFromOpener.numInputs);
		this._outputPlugs = plugs.slice(this.inputFromOpener.numInputs);

		this.inputLabelsForm = this.formBuilder.group({
			labels: this.formBuilder.array(this._inputPlugs.map(p => this.formBuilder.control(p.data ?? 'IN')))
		});
		this.outputLabelsForm = this.formBuilder.group({
			labels: this.formBuilder.array(this._outputPlugs.map(p => this.formBuilder.control(p.data ?? 'OUT')))
		});
	}

	public get inputLabelsControls(): AbstractControl[] {
		return (this.inputLabelsForm.controls.labels as FormArray).controls;
	}

	public get outputLabelsControls(): AbstractControl[] {
		return (this.outputLabelsForm.controls.labels as FormArray).controls;
	}

	public save() {
		const plugIds = [
			...shuffle(this._inputPlugs.map(p => p.id)),
			...shuffle(this._outputPlugs.map(p => p.id))
		];
		console.log(this.inputFromOpener.setPlugConfiguration(plugIds, plugIds.map((p, i) => i + '')));
		this.projectsService.labelsCustomComponentChanged(this.inputFromOpener);

		// only fo testing
		function shuffle(a) {
			for (let i = a.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[a[i], a[j]] = [a[j], a[i]];
			}
			return a;
		}
	}

}
