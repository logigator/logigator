import {Injectable} from '@angular/core';
import {IpcRenderer, Shell, SaveDialogReturnValue} from 'electron';


@Injectable({
	providedIn: 'root'
})
export class ElectronService {

	private _electron: any;

	private get electron(): any {
		if (!this._electron) {
			if (window && window.require) {
				this._electron = window.require('electron');
				return this._electron;
			}
			return undefined;
		}
		return this._electron;
	}

	public get ipcRenderer(): IpcRenderer {
		return this.electron ? this.electron.ipcRenderer : null;
	}

	public get shell(): Shell {
		return this.electron ? this.electron.shell : null;
	}

	public getFileSavePath(name: string, extension: string, dialogText: string): Promise<SaveDialogReturnValue> {
		return this.ipcRenderer.invoke('native-function-save-dialog', name, extension, dialogText);
	}
}
