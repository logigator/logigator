// #!web
import * as FileSaver from 'file-saver';
// #!electron
import {ElectronService} from 'ngx-electron';
// #!electron
import * as fs from 'fs';
// #!electron
import {SaveDialogReturnValue} from 'electron';

export async function saveLocalFile(
	toSave: string, extension: string, name: string, dialogText: string, electronService: ElectronService
): Promise<boolean> {
	// #!electron
	return saveElectron(toSave, name, extension, dialogText, electronService);

	const blob = new Blob([toSave]);
	FileSaver.saveAs(blob, `${name}.${extension}`);
	return true;
}

export async function saveLocalFileBlob(
	toSave: Blob, extension: string, name: string, dialogText: string, electronService: ElectronService
): Promise<boolean> {
	// #!electron
	return saveElectron(toSave, name, extension, dialogText, electronService);

	// #!web
	FileSaver.saveAs(toSave, `${name}.${extension}`);
	return true;
}

// #!if ELECTRON === 'true'
async function saveElectron(
	toSave: string | Blob, name: string, extension: string, dialogText: string, electronService: ElectronService
): Promise<boolean> {
	const savePath = await getSavePath(electronService, name, extension, dialogText);
	if (savePath.canceled) return false;
	if (toSave instanceof Blob) {
		const fileReader = new FileReader();
		return new Promise(resolve => {
			fileReader.onload = (event: any) => {
				fs.writeFileSync(savePath.filePath, new Buffer(event.target.result));
				resolve();
			};
			fileReader.readAsArrayBuffer(toSave);
		});
	} else {
		fs.writeFileSync(savePath.filePath, toSave);
		return true;
	}
}

function getSavePath(es: ElectronService, name: string, extension: string, dialogText: string): Promise<SaveDialogReturnValue> {
	return es.remote.dialog.showSaveDialog({
		title: dialogText,
		defaultPath: name,
		filters: [{
			name: extension,
			extensions: [extension]
		}]
	});
}
// #!endif
