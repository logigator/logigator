import {BrowserWindow, app, session} from 'electron';
import * as path from 'path';
import {WindowResizeHandler} from './window-resize-handler';
import {AuthenticationHandler} from './authentication-handler';
import {getHomeUrl, getHttpFilterUrls} from './utils';

class Main {

	private readonly _isDevMode: boolean;

	private _window: BrowserWindow;
	private _windowResizeHandler: WindowResizeHandler;
	private _authenticationHandler: AuthenticationHandler;

	private _windowHostname: string;

	constructor(isDevMode: boolean) {
		this._isDevMode = isDevMode;
	}

	public initialize() {
		app.on('ready', () => this.onReady());
		app.on('window-all-closed', () => this.onAllWindowsClosed());

		app.allowRendererProcessReuse = true;
	}

	private onReady() {
		session.defaultSession.setUserAgent('Mozilla/5.0 (Windows NT 10.0; WOW64; rv:46.0) Gecko/20100101 Firefox/46.0');

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

		if (this._isDevMode) {
			require('electron-reload')(__dirname, {
				electron: require(path.join(__dirname, `../../node_modules/electron`))
			});
			this._windowHostname = 'http://localhost:8202';
			this._window.loadURL('http://localhost:8202');
			this._window.webContents.openDevTools();
		} else {
			// TODO: load compiled app
		}

		this._windowResizeHandler = new WindowResizeHandler(this._window);
		this._windowResizeHandler.initListeners();

		this._authenticationHandler = new AuthenticationHandler(this._window, this._windowHostname);
		this._authenticationHandler.initListeners();

		this.registerHttpInterceptor();
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
		this._window.webContents.session.webRequest.onBeforeSendHeaders(getHttpFilterUrls(), (details, callback) => {
			if (this._authenticationHandler.isAuthenticated) {
				// tslint:disable-next-line:no-string-literal
				details.requestHeaders['Cookie'] = this._authenticationHandler.sessionCookie;
			}
			// tslint:disable-next-line:no-string-literal
			details.requestHeaders['Origin'] = getHomeUrl();
			// tslint:disable-next-line:no-string-literal
			details.requestHeaders['Referer'] = getHomeUrl() + '/';

			callback({
				requestHeaders: details.requestHeaders
			});
		});

		this._window.webContents.session.webRequest.onHeadersReceived(getHttpFilterUrls(), (details, callback) => {
			// tslint:disable-next-line:no-string-literal
			details.responseHeaders['Access-Control-Allow-Origin'] = [this._windowHostname];

			callback({
				responseHeaders: details.responseHeaders
			});
		});
	}

}
const main = new Main(process.argv.slice(1).some(val => val === '--serve'));
main.initialize();
