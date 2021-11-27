import {BrowserWindow, app, session} from 'electron';
import * as path from 'path';
import {URL} from 'url';
import {WindowResizeHandler} from './window-resize-handler';
import {AuthenticationHandler} from './authentication-handler';
import {ApiHandler} from './api-handler';
import {getHomeUrl} from './utils';
import {NativeFunctionsHandler} from './native-functions-hander';

class Main {

	private _loadingWindow: BrowserWindow;

	private _window: BrowserWindow;
	private _windowResizeHandler: WindowResizeHandler;
	private _authenticationHandler: AuthenticationHandler;
	private _apiHandler: ApiHandler;
	private _nativeFunctionsHandler: NativeFunctionsHandler;

	private _windowHostname: string;

	public initialize() {
		app.on('ready', () => this.onReady());
		app.on('window-all-closed', () => this.onAllWindowsClosed());

		if (process.env.DEV_MODE) {
			app.commandLine.appendSwitch('ignore-certificate-errors');
		}
	}

	private async onReady() {
		this.createLoadingWindow();
		session.defaultSession.setUserAgent('Mozilla/5.0 (Windows NT 10.0; WOW64; rv:46.0) Gecko/20100101 Firefox/46.0');

		this._window = new BrowserWindow({
			width: 1400,
			height: 725,
			minWidth: 1000,
			minHeight: 725,
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: false
			},
			frame: false,
			icon: path.join(__dirname, '..', 'logigator-editor', 'assets', 'icons', 'android-chrome-512x512.png'),
		});

		this._window.on('closed', () => this.onClosed());

		if (process.env.DEV_MODE) {
			this._windowHostname = 'http://localhost:8202';
		} else {
			this._windowHostname = new URL(path.join(__dirname, '..', 'logigator-editor', 'index.html'), 'file://').toString();
		}

		this._windowResizeHandler = new WindowResizeHandler(this._window);
		this._windowResizeHandler.initListeners();

		this._authenticationHandler = new AuthenticationHandler(this._window);
		this._authenticationHandler.initListeners();

		this._apiHandler = new ApiHandler(this._authenticationHandler);
		this._apiHandler.initListeners();

		this._nativeFunctionsHandler = new NativeFunctionsHandler();
		this._nativeFunctionsHandler.initListeners();

		this.registerHttpInterceptor();

		if (process.env.DEV_MODE) {
			require('electron-reload')(__dirname, {
				electron: require(path.join(__dirname, `../../node_modules/electron`))
			});
			this._window.webContents.openDevTools();
		}
		this._window.webContents.once('dom-ready', () => {
			this._loadingWindow.destroy();
		});
		await this._window.loadURL(this._windowHostname);
	}

	private onClosed() {
		this._window = null;
		if (!this._loadingWindow.isDestroyed())
			this._loadingWindow.destroy();
		this._loadingWindow = null;
	}

	private onAllWindowsClosed() {
		if (process.platform !== 'darwin') {
			app.quit();
		}
	}

	private registerHttpInterceptor() {
		this._window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
			if (details.url.match(/file:\/\/\/([A-Z]:\/)?profile\//)) {
				callback({redirectURL: details.url.replace(/file:\/\/\/([A-Z]:\/)?profile\//, getHomeUrl() + '/profile/')});
			} else if (details.url.startsWith(this._windowHostname + '/profile/')) {
				callback({redirectURL: details.url.replace(this._windowHostname + '/profile/', getHomeUrl() + '/profile/')});
			} else {
				callback({});
			}
		});
	}

	private createLoadingWindow() {
		this._loadingWindow = new BrowserWindow({
			width: 500,
			height: 180,
			resizable: false,
			alwaysOnTop: true,
			webPreferences: {
				nodeIntegration: false,
				contextIsolation: true,
				devTools: false
			},
			frame: false
		});
		this._loadingWindow.loadFile(path.join(__dirname, '..', 'logigator-editor', 'assets', 'electron-loading-window.html'));
	}

}
const main = new Main();
main.initialize();
