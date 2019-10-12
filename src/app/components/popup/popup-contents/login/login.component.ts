import { Component, OnInit } from '@angular/core';
import {PopupContentComp} from '../popup-content-comp';
import {UserService} from '../../../../services/user/user.service';

@Component({
	selector: 'app-login',
	templateUrl: './login.component.html',
	styleUrls: ['./login.component.scss']
})
export class LoginComponent extends PopupContentComp implements OnInit {

	constructor(private user: UserService) {
		super();
	}

	ngOnInit() {
	}

	public loginGoogle() {
		this.user.loginGoogle();
		this.requestClose.emit();
	}

	public loginTwitter() {
		this.user.loginTwitter();
		this.requestClose.emit();
	}

}
