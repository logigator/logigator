import {ipcMain, IpcMainInvokeEvent, dialog, SaveDialogReturnValue} from 'electron';

export class NativeFunctionsHandler {

	public initListeners() {
		ipcMain.handle('native-function-save-dialog', this.onSaveDialog.bind(this));
	}

	private async onSaveDialog(event: IpcMainInvokeEvent, name: string, extension: string, dialogText: string): Promise<SaveDialogReturnValue> {
		return dialog.showSaveDialog({
			title: dialogText,
			defaultPath: name,
			filters: [{
				name: extension,
				extensions: [extension]
			}]
		});
	}

}
