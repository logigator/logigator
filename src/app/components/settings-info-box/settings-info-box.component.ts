import {Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges} from '@angular/core';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';
import {ElementType} from '../../models/element-type';
import {ProjectsService} from '../../services/projects/projects.service';
import {FormGroup, FormBuilder} from '@angular/forms';
import {Subscription} from 'rxjs';

@Component({
	selector: 'app-settings-info-box',
	templateUrl: './settings-info-box.component.html',
	styleUrls: ['./settings-info-box.component.scss']
})
export class SettingsInfoBoxComponent implements OnChanges, OnDestroy {

	@Input()
	public selectedCompTypeId: number;

	@Input()
	public selectedCompId: number;

	@Input()
	public selectionMode: 'type' | 'placed';

	public elemType: ElementType;

	public propertiesFrom: FormGroup;

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

	private initType() {
		this.elemType = this.elemProvider.getElementById(this.selectedCompTypeId);
		this.propertiesFrom = this.formBuilder.group({
			numInputs: [this.elemType.numInputs],
			rotation: [this.elemType.rotation]
		});
		this.formSubscription = this.propertiesFrom.valueChanges.subscribe((data: any) => {
			if (data.numInputs <= this.elemType.maxInputs && data.numInputs >= this.elemType.minInputs) {
				this.elemType.rotation = Number(data.rotation);
			}
			this.elemType.numInputs = data.numInputs;
		});
	}

	private initInstance() {
		const element = this.projects.currProject.currState.getElementById(this.selectedCompId);
		this.elemType = this.elemProvider.getElementById(element.typeId);
		this.propertiesFrom = this.formBuilder.group({
			numInputs: [element.numInputs],
			rotation: [element.rotation]
		});
		this.formSubscription = this.propertiesFrom.valueChanges.subscribe((data: any) => {
			if (data.rotation !== element.rotation) {
				this.projects.currProject.rotateComponent(this.selectedCompId, Number(data.rotation));
			}
			if (data.numInputs !== element.numInputs && data.numInputs <= this.elemType.maxInputs && data.numInputs >= this.elemType.minInputs) {
				this.projects.currProject.setNumInputs(this.selectedCompId, data.numInputs);
			}
		});
	}

	ngOnDestroy(): void {
		if (this.formSubscription) {
			this.formSubscription.unsubscribe();
		}
	}

}
