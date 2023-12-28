import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {UntypedFormControl, Validators} from '@angular/forms';
import {PopupContentComp} from '../../popup/popup-content-comp';

@Component({
	selector: 'app-text',
	templateUrl: './text.component.html',
	styleUrls: ['./text.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TextComponent extends PopupContentComp<string, string> implements OnInit {

	public text: UntypedFormControl;

	constructor() {
		super();
	}

	ngOnInit() {
		this.text = new UntypedFormControl(this.inputFromOpener, [Validators.required]);
	}

	public setText() {
		this.requestClose.emit(this.text.value);
	}

}
