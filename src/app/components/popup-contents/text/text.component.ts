import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {FormControl, Validators} from '@angular/forms';
import {PopupContentComp} from '@logigator/logigator-shared-comps';

@Component({
	selector: 'app-text',
	templateUrl: './text.component.html',
	styleUrls: ['./text.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TextComponent extends PopupContentComp implements OnInit {

	public text: FormControl;

	constructor() {
		super();
	}

	ngOnInit() {
		this.text = new FormControl(this.inputFromOpener, [Validators.required]);
	}

	public setText() {
		this.requestClose.emit(this.text.value);
	}

}
