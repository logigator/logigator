import {Injectable, Optional} from '@angular/core';
import {Observable} from 'rxjs';
import {UserInfo} from '../../models/http-responses/user-info';
import {HttpClient} from '@angular/common/http';
import {ErrorHandlingService} from '../error-handling/error-handling.service';

import {ElectronService} from 'ngx-electron';

@Injectable({
	providedIn: 'root'
})
export class UserService {

	private _userInfo$: Observable<UserInfo>;

	private _isLoggedIn: boolean;

	constructor(
		private http: HttpClient,
		private errorHandling: ErrorHandlingService,
		@Optional() private electronService: ElectronService,
	) {
		this._isLoggedIn = false;
	}

	public get isLoggedIn(): boolean {
		return this._isLoggedIn;
	}

	public get userInfo$(): Observable<UserInfo> {
		return this._userInfo$;
	}
}
