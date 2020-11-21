import {BrowserWindow, app, session} from 'electron';
import * as path from 'path';
import * as url from 'url';
import {WindowResizeHandler} from './window-resize-handler';
import {AuthenticationHandler} from './authentication-handler';
import {ApiHandler} from './api-handler';
import {getHomeUrl} from './utils';

class Main {

	private readonly _isDevMode: boolean;

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
			this._windowHostname = url.format({
				pathname: path.join(__dirname, '..', 'logigator-editor', 'index.html'),
				protocol: 'file',
				slashes: true
			});
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
		await this._window.loadURL(this._windowHostname);
	}

	private onClosed() {
		this._window = null;
	}

	private onAllWindowsClosed() {
		if (process.platform !== 'darwin') {
			app.quit();
		}
	}

	private registerHttpInterceptor() {
		this._window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
			if (details.url.startsWith('file:///persisted/')) {
				callback({redirectURL: details.url.replace('file:///persisted/', getHomeUrl() + '/persisted/')});
			} else if (details.url.startsWith(this._windowHostname + '/persisted/')) {
				callback({redirectURL: details.url.replace(this._windowHostname + '/persisted/', getHomeUrl() + '/persisted/')});
			} else {
				callback({});
			}
		});
	}

}
const main = new Main(process.argv.slice(1).some(val => val === '--serve'));
main.initialize();
