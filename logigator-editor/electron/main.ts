import {BrowserWindow, app, session} from 'electron';
import * as path from 'path';
import {URL} from 'url';
import {WindowResizeHandler} from './window-resize-handler';
import {AuthenticationHandler} from './authentication-handler';
import {ApiHandler} from './api-handler';
import {getHomeUrl} from './utils';

class Main {

	private readonly _isDevMode: boolean;

	private _loadingWindow: BrowserWindow;

	private _window: BrowserWindow;
	private _windowResizeHandler: WindowResizeHandler;
	private _authenticationHandler: AuthenticationHandler;
	private _apiHandler: ApiHandler;

	private _windowHostname: string;

	constructor(isDevMode: boolean) {
		this._isDevMode = isDevMode;
	}

	public initialize() {
		app.on('ready', () => this.onReady());
		app.on('window-all-closed', () => this.onAllWindowsClosed());

		app.allowRendererProcessReuse = true;
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
			},
			frame: false,
			icon: path.join(__dirname, '..', 'logigator-editor', 'assets', 'icons', 'android-chrome-512x512.png'),
		});

		this._window.on('closed', () => this.onClosed());

		if (this._isDevMode) {
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

		this.registerHttpInterceptor();

		if (this._isDevMode) {
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
			if (details.url.startsWith('file:///profile/')) {
				callback({redirectURL: details.url.replace('file:///profile/', getHomeUrl() + '/profile/')});
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
				nodeIntegration: false
			},
			frame: false
		});
		this._loadingWindow.loadFile(path.join(__dirname, '..', 'logigator-editor', 'assets', 'electron-loading-window.html'));
	}

}
const main = new Main(process.argv.slice(1).some(val => val === '--serve'));
main.initialize();
