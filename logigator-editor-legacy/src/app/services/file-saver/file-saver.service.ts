import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class FileSaverService {
	constructor() {}

	public async saveLocalFile(toSave: string, extension: string, name: string) {
		return this.saveLocalFileBlob(
			new Blob([toSave], { type: 'text/plain' }),
			extension,
			name
		);
	}

	public async saveLocalFileBlob(
		toSave: Blob,
		extension: string,
		name: string
	) {
		const element = document.createElement('a');
		element.download = `${name}.${extension}`;
		element.href = (window.webkitURL || window.URL).createObjectURL(toSave);
		element.click();
		return true;
	}
}
