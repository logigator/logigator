import {Inject, Injectable, Optional} from '@angular/core';
import {Observable, ReplaySubject, timer} from 'rxjs';
import {User} from '../../models/http/response/user';
import {ApiService} from '../api/api.service';
import {distinctUntilChanged, map} from 'rxjs/operators';
import {ElectronService} from 'ngx-electron';
import {StorageService, StorageServiceModel} from '../storage/storage.service';

@Injectable({
	providedIn: 'root'
})
export class UserService {

	private readonly _userInfo$ = new ReplaySubject<User>(1);

	private _isLoggedIn: boolean;

	constructor(
		private api: ApiService,
		@Inject(StorageService) private storage: StorageServiceModel,
		@Optional() private electronService: ElectronService
	) {
		this._isLoggedIn = this.checkLoginState();

		timer(0, 1500).pipe(
			map(() => this.checkLoginState()),
			distinctUntilChanged(),
		).subscribe(async loggedIn =>  {
			this._isLoggedIn = loggedIn;

			if (!loggedIn) {
				this._userInfo$.next(undefined);
				return;
			}
			try {
				const user = await this.api.get<User>('/user', {errorMessage: 'ERROR.USER.GET_INFO'}).toPromise();
				this._userInfo$.next(user.data);
			} catch {
				this._isLoggedIn = false;
				this._userInfo$.next(undefined);
			}
		});
	}

	public get isLoggedIn(): boolean {
		return this._isLoggedIn;
	}

	public get userInfo$(): Observable<User> {
		return this._userInfo$.asObservable();
	}

	// #!if ELECTRON === 'true'
	public login() {
		this.electronService.ipcRenderer.invoke('login');
	}

	public logout() {
		this.electronService.ipcRenderer.invoke('logout');
	}
	// #!endif

	private checkLoginState(): boolean {
		return this.storage.get('isAuthenticated') + '' === 'true';
	}
}
