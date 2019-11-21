import { Component, OnInit } from '@angular/core';
import {PopupContentComp} from '../popup-content-comp';
import {FormControl, Validators} from '@angular/forms';

@Component({
	selector: 'app-text',
	templateUrl: './text.component.html',
	styleUrls: ['./text.component.scss']
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
