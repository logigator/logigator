import {ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, SimpleChanges} from '@angular/core';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';
import {ElementType} from '../../models/element-types/element-type';
import {ProjectsService} from '../../services/projects/projects.service';
import {FormArray, FormBuilder, FormControl, FormGroup} from '@angular/forms';
import {of, Subscription, timer} from 'rxjs';
import {debounce} from 'rxjs/operators';

@Component({
	selector: 'app-settings-info-box',
	templateUrl: './settings-info-box.component.html',
	styleUrls: ['./settings-info-box.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsInfoBoxComponent implements OnChanges, OnDestroy {

	@Input()
	public selectedCompTypeId: number;

	@Input()
	public selectedCompId: number;

	@Input()
	public selectionMode: 'type' | 'placed';

	public elemType: ElementType;

	public propertiesForm: FormGroup;

	private formSubscription: Subscription;

	constructor(
		private elemProvider: ElementProviderService,
		private projects: ProjectsService,
		private formBuilder: FormBuilder
	) { }

	ngOnChanges(changes: SimpleChanges): void {
		if (this.formSubscription) {
			this.formSubscription.unsubscribe();
		}

		if (this.selectionMode === 'type') {
			this.initType();
		} else {
			this.initInstance();
		}
	}

	editComponentClick() {
		this.projects.openComponent(this.selectedCompTypeId);
	}

	public get isPlugElement(): boolean {
		return this.elemProvider.isPlugElement(this.selectedCompTypeId);
	}

	public get possiblePlugIndexes(): number[] {
		if (this.selectedCompId === undefined) return [];
		return this.projects.currProject.possiblePlugIndexes(this.selectedCompId);
	}

	public toUserPlugIndex(possibleIndex: number): number {
		if (this.elemProvider.isInputElement(this.selectedCompTypeId)) {
			return possibleIndex + 1;
		} else if (this.elemProvider.isOutputElement(this.selectedCompTypeId)) {
			return possibleIndex - this.projects.currProject.numInputs + 1;
		}
	}

	private initType() {
		this.elemType = this.elemProvider.getElementById(this.selectedCompTypeId);
		this.propertiesForm = this.formBuilder.group({
			numInputs: [this.elemType.numInputs],
			rotation: [this.elemType.rotation],
			plugIndex: [],
			options: this.formBuilder.array(this.getOptionsArray(this.elemType, this.elemType.options))
		});
		this.formSubscription = this.propertiesForm.valueChanges.subscribe((data: any) => {
			if (data.rotation !== this.elemType.rotation) {
				this.elemType.rotation = Number(data.rotation);
			}
			if (data.numInputs <= this.elemType.maxInputs && data.numInputs >= this.elemType.minInputs) {
				this.elemType.numInputs = data.numInputs;
			} else if (data.numInputs * 10 >= this.elemType.maxInputs) {
				this.propertiesForm.controls.numInputs.setValue(this.elemType.numInputs);
			}

			if (this.elemType.optionsConfig) {
				for (let i = 0; i < data.options.length; i++) {
					const optVal = Number(data.options[i]);
					if (optVal <= this.elemType.optionsConfig[i].max && optVal >= this.elemType.optionsConfig[i].min) {
						this.elemType.options[i] = optVal;
					} else if (optVal * 10 >= this.elemType.optionsConfig[i].max) {
						(this.propertiesForm.get('options') as FormArray).controls[i].setValue(this.elemType.options[i]);
					}
				}
			}
		});
	}

	private initInstance() {
		const element = this.projects.currProject.currState.getElementById(this.selectedCompId);
		this.selectedCompTypeId = element.typeId;
		this.elemType = this.elemProvider.getElementById(element.typeId);
		this.propertiesForm = this.formBuilder.group({
			numInputs: [element.numInputs],
			rotation: [element.rotation],
			plugIndex: [element.plugIndex],
			options: this.formBuilder.array(this.getOptionsArray(this.elemType, element.options))
		});
		this.formSubscription = this.propertiesForm.valueChanges.subscribe((data: any) => {
			if (data.rotation !== element.rotation) {
				if (!this.projects.currProject.rotateComponent(this.selectedCompId, Number(data.rotation))) {
					this.propertiesForm.controls.rotation.setValue(element.rotation);
				}
			}
			if (data.numInputs <= this.elemType.maxInputs && data.numInputs >= this.elemType.minInputs) {
				if (data.numInputs !== element.numInputs && !this.projects.currProject.setNumInputs(this.selectedCompId, data.numInputs)) {
					this.propertiesForm.controls.numInputs.setValue(element.numInputs);
				}
			} else if (data.numInputs * 10 >= this.elemType.maxInputs) {
				this.propertiesForm.controls.numInputs.setValue(element.numInputs);
			}
			if (data.plugIndex !== element.plugIndex) {
				this.projects.currProject.setPlugIndex(this.selectedCompId, Number(data.plugIndex));
				this.propertiesForm.controls.plugIndex.setValue(element.plugIndex);
			}

			if (this.elemType.optionsConfig) {
				for (let i = 0; i < data.options.length; i++) {
					const optVal = Number(data.options[i]);
					if (optVal <= this.elemType.optionsConfig[i].max && optVal >= this.elemType.optionsConfig[i].min) {
						element.options[i] = optVal;
						this.projects.currProject.setOptions(element.id, element.options);
					} else if (optVal * 10 >= this.elemType.optionsConfig[i].max) {
						(this.propertiesForm.get('options') as FormArray).controls[i].setValue(this.elemType.options[i]);
					}
				}
			}
		});
	}

	public resetNumInputsValue() {
		const currVal = this.propertiesForm.controls.numInputs.value;
		if (currVal > this.elemType.maxInputs || currVal < this.elemType.minInputs) {
			let valToSet: number;
			if (this.selectionMode === 'placed') {
				valToSet = this.projects.currProject.currState.getElementById(this.selectedCompId).numInputs;
			} else {
				valToSet = this.elemType.numInputs;
			}
			this.propertiesForm.controls.numInputs.setValue(valToSet);
		}
	}

	public resetOptionsValue(index: number) {
		const optVal = Number((this.propertiesForm.get('options') as FormArray).controls[index].value);
		if (optVal > this.elemType.optionsConfig[index].max || optVal < this.elemType.optionsConfig[index].min) {
			let valToSet: number;
			if (this.selectionMode === 'placed') {
				valToSet = this.projects.currProject.currState.getElementById(this.selectedCompId).options[index];
			} else {
				valToSet = this.elemType.options[index];
			}
			(this.propertiesForm.get('options') as FormArray).controls[index].setValue(valToSet);
		}
	}

	private getOptionsArray(elemType: ElementType, opts: number[]): FormControl[] {
		const formArray = [];
		if (!elemType.optionsConfig) return formArray;
		elemType.optionsConfig.forEach((oc, index) => {
			formArray.push(this.formBuilder.control(opts[index]));
		});
		return formArray;
	}

	public getOptionFromControl(index: number): FormControl {
		return (this.propertiesForm.get('options') as FormArray).controls[index] as FormControl;
	}

	ngOnDestroy(): void {
		if (this.formSubscription) {
			this.formSubscription.unsubscribe();
		}
	}

}
