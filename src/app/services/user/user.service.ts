import {Inject, Injectable} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {Observable, of} from 'rxjs';
import {UserInfo} from '../../models/http-responses/user-info';
import {map, share, switchMap} from 'rxjs/operators';
import {HttpClient} from '@angular/common/http';
import {HttpResponseData} from '../../models/http-responses/http-response-data';

@Injectable({
	providedIn: 'root'
})
export class UserService {

	private readonly _isLoggedIn;

	private _userInfo$: Observable<UserInfo>;

	constructor(@Inject(DOCUMENT) private document: Document, private http: HttpClient) {
		this._isLoggedIn = this.getLoginStateFromCookie;
		this.getUserInfoFromServer();
	}

	private getUserInfoFromServer() {
		this._userInfo$ = of(this.isLoggedIn).pipe(
			switchMap(isLoggedIn => {
				if (!isLoggedIn) return of(undefined);

				return this.http.get<HttpResponseData<UserInfo>>('/api/user/get').pipe(
					map(response => response.result)
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
		return this._isLoggedIn;
	}

	public get userInfo$(): Observable<UserInfo> {
		return this._userInfo$;
	}
}
