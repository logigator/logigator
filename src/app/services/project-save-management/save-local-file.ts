import {ProjectLocalFile} from '../../models/project-local-file';
import * as FileSaver from 'file-saver';
// #!electron
import {ElectronService} from 'ngx-electron';
// #!electron
import * as fs from 'fs';
// #!electron
import {SaveDialogReturnValue} from 'electron';

export async function saveLocalFile(toSave: ProjectLocalFile, name: string, electronService: ElectronService): Promise<boolean> {
	// #!electron
	return saveElectron(toSave, name, electronService);

	const blob = new Blob([JSON.stringify(toSave, null, 2)], {type: 'application/json;charset=utf-8'});
	FileSaver.saveAs(blob, `${name}.json`);
	return true;
}

// #!if ELECTRON === 'true'
async function saveElectron(toSave: ProjectLocalFile, name: string, electronService: ElectronService): Promise<boolean> {
	const savePath = await getSavePath(electronService, name);
	if (savePath.canceled) return false;
	fs.writeFileSync(savePath.filePath, JSON.stringify(toSave, null, 2));
	return true;
}

function getSavePath(es: ElectronService, name: string): Promise<SaveDialogReturnValue> {
	return es.remote.dialog.showSaveDialog({
		title: 'Save Project',
		defaultPath: name,
		filters: [{
			name: 'Json',
			extensions: ['json']
		}]
	});
}
// #!endif
