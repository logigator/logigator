import {ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, SimpleChanges} from '@angular/core';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';
import {ElementType} from '../../models/element-types/element-type';
import {ProjectsService} from '../../services/projects/projects.service';
import {FormBuilder, FormGroup} from '@angular/forms';
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

	public get isDelayElement(): boolean {
		return this.elemProvider.isDelayElement(this.selectedCompTypeId);
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
			plugIndex: []
		});
		this.formSubscription = this.propertiesForm.valueChanges.pipe(
			debounce(value => {
				if (value.numInputs !== this.elemType.numInputs) return timer(1000);
				return of(undefined);
			})
		).subscribe((data: any) => {
			if (data.rotation !== this.elemType.rotation) {
				this.elemType.rotation = Number(data.rotation);
			}
			if (data.numInputs <= this.elemType.maxInputs && data.numInputs >= this.elemType.minInputs) {
				this.elemType.numInputs = data.numInputs;
			} else if (data.numInputs) {
				this.propertiesForm.controls.numInputs.setValue(this.elemType.numInputs);
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
			plugIndex: [element.plugIndex]
		});
		this.formSubscription = this.propertiesForm.valueChanges.pipe(
			debounce(value => {
				if (value.numInputs !== element.numInputs) return timer(1000);
				return of(undefined);
			})
		).subscribe((data: any) => {
			if (data.rotation !== element.rotation) {
				if (!this.projects.currProject.rotateComponent(this.selectedCompId, Number(data.rotation))) {
					this.propertiesForm.controls.rotation.setValue(element.rotation);
				}
			}
			if (data.numInputs <= this.elemType.maxInputs && data.numInputs >= this.elemType.minInputs) {
				if (data.numInputs !== element.numInputs && !this.projects.currProject.setNumInputs(this.selectedCompId, data.numInputs)) {
					this.propertiesForm.controls.numInputs.setValue(element.numInputs);
				}
			} else if (data.numInputs) {
				this.propertiesForm.controls.numInputs.setValue(element.numInputs);
			}
			if (data.plugIndex !== element.plugIndex) {
				this.projects.currProject.setPlugIndex(this.selectedCompId, Number(data.plugIndex));
				this.propertiesForm.controls.plugIndex.setValue(element.plugIndex);
			}
		});
	}

	ngOnDestroy(): void {
		if (this.formSubscription) {
			this.formSubscription.unsubscribe();
		}
	}

}
