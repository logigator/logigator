import {Injectable, Optional} from '@angular/core';
import {Theme} from '../../models/theming';
import {StorageService} from '../storage/storage.service';
import {ElectronService} from 'ngx-electron';

@Injectable({
	providedIn: 'root'
})
export class InitService {

	private _themingServiceData: Theme;

	private _currentSelectedLanguage: string;

	private _helpWindowServiceData: Set<string>;

	private _electronIsLoggedIn: boolean;

	constructor(private storage: StorageService, @Optional() private electronService: ElectronService) {}

	public async initializeServiceData() {
		this._themingServiceData = (await this.storage.get('theme') || 'dark') as Theme;
		this._currentSelectedLanguage = await this.storage.get('lang');
		const helpWindowData = await this.storage.get('helpWindows');
		this._helpWindowServiceData = helpWindowData ? new Set(helpWindowData) : new Set<string>();

		// #!electron
		this._electronIsLoggedIn = await this.electronService.ipcRenderer.invoke('isLoggedIn');
	}

	public get themingServiceData(): Theme {
		return this._themingServiceData;
	}

	public get currentSelectedLanguage(): string {
		return this._currentSelectedLanguage;
	}

	get helpWindowServiceData(): Set<string> {
		return this._helpWindowServiceData;
	}

	get electronIsLoggedIn(): boolean {
		return this._electronIsLoggedIn;
	}
}
