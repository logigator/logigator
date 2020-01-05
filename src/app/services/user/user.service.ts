import {Inject, Injectable, Optional} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {interval, Observable, of, Subject} from 'rxjs';
import {UserInfo} from '../../models/http-responses/user-info';
import {map, switchMap} from 'rxjs/operators';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {HttpResponseData} from '../../models/http-responses/http-response-data';
import {ErrorHandlingService} from '../error-handling/error-handling.service';

import {ElectronService} from 'ngx-electron';
import {environment} from '../../../environments/environment';

@Injectable({
	providedIn: 'root'
})
export class UserService {

	private _userInfo$: Observable<UserInfo>;
	private _userLoginStateInSubject = new Subject<boolean>();

	private lastCheckedLoginState: boolean;

	constructor(
		@Inject(DOCUMENT) private document: Document,
		private http: HttpClient,
		private errorHandling: ErrorHandlingService,
		@Optional() private electronService: ElectronService
	) {
		this.getUserInfoFromServer();
		interval(2000).subscribe(() => this.loginStateCheck());
	}

	private getUserInfoFromServer() {
		this._userInfo$ = of(this.isLoggedIn).pipe(
			switchMap(isLoggedIn => {
				if (!isLoggedIn) return of(undefined);
				return this.http.get<HttpResponseData<UserInfo>>(environment.apiPrefix + '/user/get').pipe(
					map(response => response.result),
					this.errorHandling.catchErrorOperator('ERROR.USER.GET_INFO', undefined)
				);
			})
		);
	}

	// #!if ELECTRON === 'true'
	public authenticateTwitter(): Promise<void> {
		return this.login('twitter');
	}

	public authenticateGoogle(): Promise<void> {
		return this.login('google');
	}

	public loginEmail(user: string, password: string): Promise<void> {
		return this.login('email', {user, password});
	}

	public async registerEmail(username: string, email: string, password: string, recaptcha: string) {
		this.electronService.ipcRenderer.send('registeremail', {username, email, password, recaptcha});
		return new Promise<string>((resolve, reject) => {
			this.electronService.ipcRenderer.once('loginemailResponse', ((event, args) => {
				if (args === 'success') {
					resolve();
					return;
				}
				reject(new HttpErrorResponse({error: args}));
			}));
		});
	}

	private login(type: 'google' | 'twitter' | 'email', credentials?: {user: string, password: string}): Promise<void> {
		this.electronService.ipcRenderer.send('login' + type, credentials);
		return new Promise<void>((resolve, reject) => {
			this.electronService.ipcRenderer.once('login' + type + 'Response', ((event, args) => {
				if (args === 'success') {
					this._userLoginStateInSubject.next(true);
					this.getUserInfoFromServer();
					resolve();
					return;
				}
				reject(reject(new HttpErrorResponse({error: args})));
			}));
		});

	}

	public logout() {
		this.electronService.remote.getGlobal('isLoggedIn').data = 'false';

		this.electronService.ipcRenderer.send('logout');
		this._userInfo$ = of(undefined);
	}
	// #!endif

	public get isLoggedIn(): boolean {
		// #!if ELECTRON === 'true'
		if (this.electronService && this.electronService.remote.getGlobal('isLoggedIn')) {
			return this.electronService.remote.getGlobal('isLoggedIn').data === 'true';
		}
		// #!endif

		const isLoggedIn = this.document.cookie.match('(^|[^;]+)\\s*' + 'isLoggedIn' + '\\s*=\\s*([^;]+)');
		if (!isLoggedIn) {
			return false;
		}
		return isLoggedIn[0] !== '' && isLoggedIn[0].endsWith('true');
	}

	public get userInfo$(): Observable<UserInfo> {
		return this._userInfo$;
	}

	public get userLoginState$(): Observable<boolean> {
		return this._userLoginStateInSubject.asObservable();
	}

	private loginStateCheck() {
		const isLoggedIn = this.isLoggedIn;
		if (isLoggedIn === this.lastCheckedLoginState) return;
		this.lastCheckedLoginState = isLoggedIn;
		if (isLoggedIn) {
			this._userLoginStateInSubject.next(true);
			this.getUserInfoFromServer();
		} else {
			this._userInfo$ = of(undefined);
			this._userLoginStateInSubject.next(false);
		}
	}
}
