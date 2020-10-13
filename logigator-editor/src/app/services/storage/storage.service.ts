import {Injectable, Optional} from '@angular/core';
import {ElectronService} from 'ngx-electron';

@Injectable({
	providedIn: 'root'
})
export class StorageService {

	constructor(@Optional() private electronService: ElectronService) {}

	public get(key: string): Promise<any> {
		// #!if ELECTRON === 'true'
		return this.electronService.ipcRenderer.invoke('storageKeyRead', {key});
		// #!else
		const data = localStorage.getItem(key);
		try {
			return Promise.resolve(JSON.parse(data));
		} catch (e) {
			return Promise.resolve(data);
		}
		// #!endif
	}

	public set(key: string, data: any) {
		// #!if ELECTRON === 'true'
		this.electronService.ipcRenderer.invoke('storageKeyChanged', {key, data});
		// #!else
		localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data));
		// #!endif
	}

	public remove(key: string) {
		// #!if ELECTRON === 'true'
		this.electronService.ipcRenderer.invoke('storageKeyRemoved', {key});
		// #!else
		localStorage.removeItem(key);
		// #!endif
	}

	public has(key: string): Promise<boolean> {
		// #!if ELECTRON === 'true'
		return this.electronService.ipcRenderer.invoke('storageKeyHas', {key});
		// #!else
		return Promise.resolve(!!localStorage.getItem(key));
		// #!endif
	}
}
