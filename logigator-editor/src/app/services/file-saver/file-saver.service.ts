import {Injectable, Optional} from '@angular/core';
// #!electron
import {ElectronService} from 'ngx-electron';
// #!electron
import * as fs from 'fs';

@Injectable({
	providedIn: 'root'
})
export class FileSaverService {

	constructor(@Optional() private electronService: ElectronService) { }

	// #!if ELECTRON === 'true'
	private async saveElectron(toSave: string | Blob, name: string, extension: string, dialogText: string): Promise<boolean> {
		const savePath = await this.getSavePath(name, extension, dialogText);
		if (savePath.canceled) return false;
		if (toSave instanceof Blob) {
			const fileReader = new FileReader();
			return new Promise(resolve => {
				fileReader.onload = (event: any) => {
					fs.writeFileSync(savePath.filePath, Buffer.from(event.target.result));
					resolve();
				};
				fileReader.readAsArrayBuffer(toSave);
			});
		} else {
			fs.writeFileSync(savePath.filePath, toSave);
			return true;
		}
	}

	private getSavePath(name: string, extension: string, dialogText: string) {
		return this.electronService.remote.dialog.showSaveDialog({
			title: dialogText,
			defaultPath: name,
			filters: [{
				name: extension,
				extensions: [extension]
			}]
		});
	}
	// #!endif

	public async saveLocalFile(toSave: string, extension: string, name: string, dialogText: string) {
		return this.saveLocalFileBlob(new Blob([toSave], {type: 'text/plain'}), extension, name, dialogText);
	}

	public async saveLocalFileBlob(toSave: Blob, extension: string, name: string, dialogText: string) {
		// #!electron
		return this.saveElectron(toSave, name, extension, dialogText);

		const element = document.createElement('a');
		element.download = `${name}.${extension}`;
		element.href = (window.webkitURL || window.URL).createObjectURL(toSave);
		element.click();
		return true;
	}
}
