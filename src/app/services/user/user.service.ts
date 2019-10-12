import {Inject, Injectable} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {Observable, of} from 'rxjs';
import {UserInfo} from '../../models/http-responses/user-info';
import {map, share, switchMap} from 'rxjs/operators';
import {HttpClient} from '@angular/common/http';
import {HttpResponseData} from '../../models/http-responses/http-response-data';
import {ErrorHandlingService} from '../error-handling/error-handling.service';
import {ElectronService} from 'ngx-electron';

@Injectable({
	providedIn: 'root'
})
export class UserService {

	private _isLoggedIn;

	private _userInfo$: Observable<UserInfo>;

	constructor(
		@Inject(DOCUMENT) private document: Document,
		private http: HttpClient,
		private errorHandling: ErrorHandlingService,
		private electronService: ElectronService
	) {
		this.getUserInfoFromServer();
	}

	private getUserInfoFromServer() {
		this._userInfo$ = of(this.isLoggedIn).pipe(
			switchMap(isLoggedIn => {
				if (!isLoggedIn) return of(undefined);

				return this.http.get<HttpResponseData<UserInfo>>('/api/user/get').pipe(
					map(response => response.result),
					this.errorHandling.catchErrorOperator('Unaable to get user info', undefined)
				);
			})
		);
	}

	private get getLoginStateFromCookie(): boolean {
		const isLoggedIn = this.document.cookie.match('(^|[^;]+)\\s*' + 'isLoggedIn' + '\\s*=\\s*([^;]+)');
		if (!isLoggedIn) {
			return false;
		}
		return isLoggedIn[0] !== '' && isLoggedIn[0].endsWith('true');
	}

	public get isLoggedIn(): boolean {
		if (this._isLoggedIn === undefined) {
			this._isLoggedIn = this.getLoginStateFromCookie;
		}
		return this._isLoggedIn;
	}

	public get userInfo$(): Observable<UserInfo> {
		return this._userInfo$;
	}

	public loginTwitter() {
		this.loginSocial('twitter');
	}

	public loginGoogle() {
		this.loginSocial('google');
	}

	private loginSocial(type: 'google' | 'twitter') {
		this.electronService.ipcRenderer.send('login' + type);
		this.electronService.ipcRenderer.once('login' + type + 'Response', ((event, args) => {
			if (args === 'success') {
				this.getUserInfoFromServer();
			}
			this.errorHandling.showErrorMessage('Error while logging in');
		}));
	}
}
