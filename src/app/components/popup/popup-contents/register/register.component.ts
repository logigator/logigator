import { Component, OnInit } from '@angular/core';
import {PopupContentComp} from '../popup-content-comp';

@Component({
	selector: 'app-register',
	templateUrl: './register.component.html',
	styleUrls: ['./register.component.scss']
})
export class RegisterComponent extends PopupContentComp implements OnInit {

	constructor() {
		super();
	}

	ngOnInit() {
	}

}
