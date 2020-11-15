import {BrowserWindow, app} from 'electron';
import * as path from 'path';
import {WindowResizeHandler} from './window-resize-handler';
import {AuthenticationHandler} from './authentication-handler';

class Main {

	private readonly _isDevMode: boolean;

	private _window: BrowserWindow;
	private _windowResizeHandler: WindowResizeHandler;
	private _authenticationHandler: AuthenticationHandler;

	constructor(isDevMode: boolean) {
		this._isDevMode = isDevMode;
	}

	public initialize() {
		app.on('ready', () => this.onReady());
		app.on('window-all-closed', () => this.onAllWindowsClosed());

		app.allowRendererProcessReuse = true;
	}

	private onReady() {
		this._window = new BrowserWindow({
			width: 1400,
			height: 725,
			minWidth: 1000,
			minHeight: 725,
			webPreferences: {
				nodeIntegration: true,
			},
			frame: false
		});

		this._window.on('closed', () => this.onClosed());

		this._windowResizeHandler = new WindowResizeHandler(this._window);
		this._windowResizeHandler.initListeners();

		this._authenticationHandler = new AuthenticationHandler();
		this._authenticationHandler.initListeners();

		if (this._isDevMode) {
			require('electron-reload')(__dirname, {
				electron: require(path.join(__dirname, `../../node_modules/electron`))
			});
			this._window.loadURL('http://localhost:8202');
			this._window.webContents.openDevTools();
		} else {
			// TODO: load compiled app
		}
	}

	private onClosed() {
		this._window = null;
	}

	private onAllWindowsClosed() {
		if (process.platform !== 'darwin') {
			app.quit();
		}
	}
}
const main = new Main(process.argv.slice(1).some(val => val === '--serve'));
main.initialize();
