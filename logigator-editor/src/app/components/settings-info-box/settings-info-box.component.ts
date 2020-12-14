import {ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, SimpleChanges} from '@angular/core';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';
import {ElementType} from '../../models/element-types/element-type';
import {ProjectsService} from '../../services/projects/projects.service';
import {AbstractControl, FormArray, FormBuilder, FormControl, FormGroup} from '@angular/forms';
import {Subscription} from 'rxjs';
import {ElementTypeId} from '../../models/element-types/element-type-ids';
import {Element} from '../../models/element';
import {ShortcutsService} from '../../services/shortcuts/shortcuts.service';
import {EditorInteractionService} from '../../services/editor-interaction/editor-interaction.service';

@Component({
	selector: 'app-settings-info-box',
	templateUrl: './settings-info-box.component.html',
	styleUrls: ['./settings-info-box.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsInfoBoxComponent implements OnChanges, OnDestroy {

	@Input()
	public selectedElemTypeId: number;

	@Input()
	public selectedCompId: number;

	private _element: Element;
	public elementType: ElementType;

	public propertiesForm: FormGroup;
	private formSubscription: Subscription;

	constructor(
		private elemProvider: ElementProviderService,
		private projects: ProjectsService,
		private formBuilder: FormBuilder,
		private editorActions: ShortcutsService,
		private editorInteractionService: EditorInteractionService
	) { }

	ngOnChanges(changes: SimpleChanges): void {
		if (this.formSubscription) {
			this.formSubscription.unsubscribe();
		}
		this._element = this.selectedCompId ? this.projects.currProject.currState.getElementById(this.selectedCompId) : undefined;
		this.elementType = this.elemProvider.getElementById(this.selectedElemTypeId);
		this.propertiesForm = this.formBuilder.group({
			numInputs: [this.selectedCompId ? this._element.numInputs : this.elementType.numInputs],
			rotation: [this.selectedCompId ? this._element.rotation : this.elementType.rotation],
			plugIndex: [this.selectedCompId ? this._element.plugIndex : undefined],
			label: [this._element && this._element.data ? this._element.data : ''],
			options: this.formBuilder.array(
				this.getOptionsArray(this.elementType, this.selectedCompId ? this._element.options : this.elementType.options)
			)
		});
		this.formSubscription = this.propertiesForm.valueChanges.subscribe(data => {
			data.rotation = Number(data.rotation || 0);
			// is element placed in project
			if (this.selectedCompId) {
				if (this.elementType.isRotatable && data.rotation !== this._element.rotation) {
					if (!this.projects.currProject.rotateComponent(this.selectedCompId, Number(data.rotation))) {
						this.propertiesForm.controls.rotation.setValue(this._element.rotation);
					}
				}
				if (data.numInputs <= this.elementType.maxInputs && data.numInputs >= this.elementType.minInputs) {
					if (data.numInputs !== this._element.numInputs && !this.projects.currProject.setNumInputs(this.selectedCompId, data.numInputs)) {
						this.propertiesForm.controls.numInputs.setValue(this._element.numInputs);
					}
				} else if (data.numInputs * 10 >= this.elementType.maxInputs && this.elementType.maxInputs !== this.elementType.minInputs) {
					this.propertiesForm.controls.numInputs.setValue(this._element.numInputs);
				}
				if (this.elementType.hasPlugIndex && data.plugIndex !== this._element.plugIndex) {
					this.projects.currProject.setPlugIndex(this.selectedCompId, Number(data.plugIndex));
					this.propertiesForm.controls.plugIndex.setValue(this._element.plugIndex);
					this.projects.labelsCustomComponentChanged(this.projects.currProject);
				}
				if (this.elementType.hasLabel && data.label !== this._element.data) {
					this.projects.currProject.setData(this.selectedCompId, data.label);
					this.projects.labelsCustomComponentChanged(this.projects.currProject);
				}
				if (this.elementType.optionsConfig) {
					for (let i = 0; i < data.options.length; i++) {
						const optVal = Number(data.options[i]);
						if (this.elementType.optionsConfig[i].allowedValues ||
							(optVal <= this.elementType.optionsConfig[i].max && optVal >= this.elementType.optionsConfig[i].min)
						) {
							if (this._element.options[i] !== optVal) {
								const newOptions = [...this._element.options];
								newOptions[i] = optVal;
								if (!this.projects.currProject.setOptions(this.selectedCompId, newOptions)) {
									(this.propertiesForm.controls.options as FormArray).controls[i].setValue(this._element.options[i]);
								}
							}
						} else if (optVal * 10 >= this.elementType.optionsConfig[i].max) {
							(this.propertiesForm.get('options') as FormArray).controls[i].setValue(this._element.options[i]);
						}
					}
				}
			} else {
				if (this.elementType.isRotatable && data.rotation !== this.elementType.rotation) {
					this.elementType.rotation = data.rotation;
				}
				if (data.numInputs <= this.elementType.maxInputs && data.numInputs >= this.elementType.minInputs) {
					this.elementType.numInputs = data.numInputs;
				} else if (data.numInputs * 10 >= this.elementType.maxInputs && this.elementType.maxInputs !== this.elementType.minInputs) {
					this.propertiesForm.controls.numInputs.setValue(this.elementType.numInputs);
				}
				if (this.elementType.optionsConfig) {
					for (let i = 0; i < data.options.length; i++) {
						const optVal = Number(data.options[i]);
						if (this.elementType.optionsConfig[i].allowedValues ||
							(optVal <= this.elementType.optionsConfig[i].max && optVal >= this.elementType.optionsConfig[i].min)
						) {
							this.elementType.options[i] = optVal;
							if (this.elementType.onOptionsChanged) this.elementType.onOptionsChanged();
						} else if (optVal * 10 >= this.elementType.optionsConfig[i].max) {
							(this.propertiesForm.get('options') as FormArray).controls[i].setValue(this.elementType.options[i]);
						}
					}
				}
			}
		});
	}

	editClick() {
		this.elementType.edit(this.selectedElemTypeId, this.selectedCompId, this.projects);
	}

	customisePlugs() {
		this.editorInteractionService.editCustomComponentPlugs();
	}

	onLabelChange(event: KeyboardEvent) {
		return event.key !== ',';
	}

	public get possiblePlugIndexes(): number[] {
		return this.projects.currProject.possiblePlugIndexes(this.selectedCompId);
	}

	public toUserPlugIndex(index: number): number {
		if (this.selectedElemTypeId === ElementTypeId.INPUT) {
			return index + 1;
		} else if (this.selectedElemTypeId === ElementTypeId.OUTPUT) {
			return index - this.projects.currProject.numInputs + 1;
		}
	}


	public resetNumInputsValue() {
		const currVal = this.propertiesForm.controls.numInputs.value;
		if (currVal > this.elementType.maxInputs || currVal < this.elementType.minInputs) {
			let valToSet: number;
			if (this.selectedCompId) {
				valToSet = this.projects.currProject.currState.getElementById(this.selectedCompId).numInputs;
			} else {
				valToSet = this.elementType.numInputs;
			}
			this.propertiesForm.controls.numInputs.setValue(valToSet);
		}
	}

	public resetOptionsValue(index: number) {
		const optVal = Number((this.propertiesForm.get('options') as FormArray).controls[index].value);
		if (optVal > this.elementType.optionsConfig[index].max || optVal < this.elementType.optionsConfig[index].min) {
			let valToSet: number;
			if (this.selectedCompId) {
				valToSet = this.projects.currProject.currState.getElementById(this.selectedCompId).options[index];
			} else {
				valToSet = this.elementType.options[index];
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

	public get optionsControls(): AbstractControl[] {
		return (this.propertiesForm.get('options') as FormArray).controls;
	}

	public getOptionsDropdownValue(optionConfig: number | {value: number, label: string}): number {
		return typeof optionConfig === 'number' ? optionConfig : optionConfig.value;
	}

	public getOptionsDropdownLabel(optionConfig: number | {value: number, label: string}): string {
		return typeof optionConfig === 'number' ? optionConfig.toString() : optionConfig.label;
	}

	public focusInput() {
		this.editorActions.disableShortcutListener();
	}

	public blurInput() {
		this.editorActions.enableShortcutListener();
	}

	ngOnDestroy(): void {
		this.editorActions.enableShortcutListener();
		if (this.formSubscription) {
			this.formSubscription.unsubscribe();
		}
	}

}
