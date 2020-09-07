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
import {SharedCompsAuthService} from '@logigator/logigator-shared-comps';
import {InitService} from '../init/init.service';

@Injectable({
	providedIn: 'root'
})
export class UserService implements SharedCompsAuthService {

	private _userInfo$: Observable<UserInfo>;
	private _userLoginStateInSubject = new Subject<boolean>();

	private _isLoggedIn: boolean;

	constructor(
		@Inject(DOCUMENT) private document: Document,
		private http: HttpClient,
		private errorHandling: ErrorHandlingService,
		@Optional() private electronService: ElectronService,
		private init: InitService
	) {
		this._isLoggedIn = this.init.electronIsLoggedIn;
		this.checkLoginState(false);
		this.getUserInfoFromServer();
		interval(2000).subscribe(() => this.updateLoginState());
	}

	private getUserInfoFromServer() {
		this._userInfo$ = of(this.isLoggedIn).pipe(
			switchMap(isLoggedIn => {
				if (!isLoggedIn) return of(undefined);
				return this.http.get<HttpResponseData<UserInfo>>(environment.apiPrefix + '/user/get').pipe(
					map(response => response.result),
					map(data => {
						data.user.profile_image = environment.apiPrefix + '/images/profile/' + data.user.profile_image;
						return data;
					}),
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

	public async resendVerificationMail(user: string, password: string): Promise<any> {
		return this.http.post(environment.apiPrefix + '/auth/resend-verification-mail', {user, password}).toPromise();
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

	public logout(): Promise<any> {
		this.electronService.ipcRenderer.send('logout');
		this._userInfo$ = of(undefined);
		this._isLoggedIn = false;
		return Promise.resolve();
	}
	// #!endif

	public get isLoggedIn(): boolean {
		return this._isLoggedIn;
	}

	public get userInfo$(): Observable<UserInfo> {
		return this._userInfo$;
	}

	public get userLoginState$(): Observable<boolean> {
		return this._userLoginStateInSubject.asObservable();
	}

	private async checkLoginState(checkElectron = true) {
		// #!if ELECTRON === 'true'
		if (checkElectron) {
			this._isLoggedIn = await this.electronService.ipcRenderer.invoke('isLoggedIn');
		}
		// #!else
		const isLoggedIn = this.document.cookie.match('(^|[^;]+)\\s*' + 'isLoggedIn' + '\\s*=\\s*([^;]+)');
		if (!isLoggedIn) {
			this._isLoggedIn = false
		} else {
			this._isLoggedIn = isLoggedIn[0] !== '' && isLoggedIn[0].endsWith('true');
		}
		// #!endif
	}

	private async updateLoginState() {
		const lastLoginState = this.isLoggedIn;

		await this.checkLoginState();

		if (lastLoginState === this.isLoggedIn)
			return;

		if (this._isLoggedIn) {
			this._userLoginStateInSubject.next(true);
			this.getUserInfoFromServer();
		} else {
			this._userInfo$ = of(undefined);
			this._userLoginStateInSubject.next(false);
		}
	}
}
