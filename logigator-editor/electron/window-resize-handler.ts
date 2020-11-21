import {BrowserWindow, ipcMain} from 'electron';

export class WindowResizeHandler {

	private readonly _window: BrowserWindow;

	constructor(win: BrowserWindow) {
		this._window = win;
	}

	public initListeners() {
		ipcMain.handle('windowMaximize', () => this.maximize());
		ipcMain.handle('windowMinimize', () => this.minimize());
		ipcMain.handle('windowClose', () => this.close());
	}

	private maximize() {
		if (this._window.isMaximized()) {
			this._window.unmaximize();
		} else {
			this._window.maximize();
		}
	}

	private minimize() {
		this._window.minimize();
	}

	private close() {
		this._window.close();
	}

}
