import {Injectable, Optional} from '@angular/core';
// #!electron
import * as fs from 'fs';
import {ElectronService} from '../electron/electron.service';

@Injectable({
	providedIn: 'root'
})
export class FileSaverService {

	constructor(@Optional() private electronService: ElectronService) { }

	// #!if ELECTRON === 'true'
	private async saveElectron(toSave: string | Blob, name: string, extension: string, dialogText: string): Promise<boolean> {
		const savePath = await this.electronService.getFileSavePath(name, extension, dialogText);
		if (savePath.canceled) return false;
		if (toSave instanceof Blob) {
			const fileReader = new FileReader();
			return new Promise<boolean>(resolve => {
				fileReader.onload = (event: any) => {
					fs.writeFileSync(savePath.filePath, Buffer.from(event.target.result));
					resolve(true);
				};
				fileReader.readAsArrayBuffer(toSave);
			});
		} else {
			fs.writeFileSync(savePath.filePath, toSave);
			return true;
		}
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
