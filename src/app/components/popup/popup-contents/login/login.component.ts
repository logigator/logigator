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

	public loginEmail(email: string, password: string) {
		this.user.loginEmail(email, password)
			.then(() => this.requestClose.emit())
			.catch(err => {
				// TODO: Show error in UI
			});
	}

}
