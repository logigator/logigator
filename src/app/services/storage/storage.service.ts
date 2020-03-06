import {Injectable, Optional} from '@angular/core';
import {ElectronService} from 'ngx-electron';

@Injectable({
	providedIn: 'root'
})
export class StorageService {

	constructor(@Optional() private electronService: ElectronService) {}

	public get(key: string): any {
		// #!if ELECTRON === 'true'
		return this.electronService.remote.getGlobal('storageData')[key];
		// #!else
		const data = localStorage.getItem(key);
		try {
			return JSON.parse(data);
		} catch (e) {
			return data;
		}
		// #!endif
	}

	public set(key: string, data: any) {
		// #!if ELECTRON === 'true'
		this.electronService.ipcRenderer.send('storageKeyChanged', {key, data});
		// #!else
		localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data));
		// #!endif
	}

	public remove(key: string) {
		// #!if ELECTRON === 'true'
		this.electronService.ipcRenderer.send('storageKeyRemoved', {key});
		// #!else
		localStorage.removeItem(key);
		// #!endif
	}

	public has(key: string): boolean {
		// #!if ELECTRON === 'true'
		return !!this.electronService.remote.getGlobal('storageData')[key];
		// #!else
		return !!localStorage.getItem(key);
		// #!endif
	}
}
