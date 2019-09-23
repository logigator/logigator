import {Inject, Injectable} from '@angular/core';
import {DOCUMENT} from '@angular/common';

@Injectable({
	providedIn: 'root'
})
export class UserService {

	private readonly _isLoggedIn;

	constructor(@Inject(DOCUMENT) private document: Document) {
		this._isLoggedIn = this.getLoginStateFromCookie;
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
}
