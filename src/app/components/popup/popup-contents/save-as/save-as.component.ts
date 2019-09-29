import { Component, OnInit } from '@angular/core';
import {PopupContentComp} from '../popup-content-comp';

@Component({
	selector: 'app-save-as',
	templateUrl: './save-as.component.html',
	styleUrls: ['./save-as.component.scss']
})
export class SaveAsComponent extends PopupContentComp implements OnInit {

	constructor() {
		super();
	}

	ngOnInit() {
	}

}
