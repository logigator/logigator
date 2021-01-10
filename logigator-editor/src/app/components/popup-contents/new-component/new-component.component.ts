import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {EastereggService} from '../../../services/easteregg/easteregg.service';
import {PopupContentComp} from '../../popup/popup-content-comp';

@Component({
	selector: 'app-new-component',
	templateUrl: './new-component.component.html',
	styleUrls: ['./new-component.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewComponentComponent extends PopupContentComp<any, {name: string, symbol: string, description: string, public: boolean}> implements OnInit {

	public newCompForm: FormGroup;

	constructor(private formBuilder: FormBuilder, private eastereggs: EastereggService) {
		super();
	}

	ngOnInit() {
		this.newCompForm = this.formBuilder.group({
			name: ['', [Validators.required, Validators.maxLength(20)]],
			symbol: ['', [Validators.required, Validators.maxLength(5)]],
			description: ['', [Validators.maxLength(2048)]],
			public: [true]
		});
	}

	public async fromSubmitClick() {
		if (this.newCompForm.invalid)
			return;

		const name = this.newCompForm.controls.name.value.toLowerCase().replace(' ', '');
		if (name === 'asdf' || name === 'test') {
			this.eastereggs.achieve('LAZ');
		}

		this.requestClose.emit(this.newCompForm.value);
	}

}
