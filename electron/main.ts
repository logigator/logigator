import {BrowserWindow, app, session} from 'electron';
import * as express from 'express';
import * as path from 'path';
import {AuthenticationHandler} from './authentication-handler';
import {getDomain, getHttpFilterUrls} from './utils';

const args = process.argv.slice(1);
const serve = args.some(val => val === '--serve');

let win: BrowserWindow;
let authHandler: AuthenticationHandler;

try {
	authHandler = new AuthenticationHandler();

	app.on('ready', async () => {
		let port = 8202;
		if (!serve) port = await startLocalWebServer();

		registerHttpInterceptor();
		authHandler.readSavedLoginState();
		createWindow(port);
		authHandler.initLoginListeners(win);
	});

	app.on('window-all-closed', () => {
		if (process.platform !== 'darwin') {
			app.quit();
		}
	});

} catch (e) {
	console.error(e);
	process.exit(1);
}

function createWindow(port: number) {
	win = new BrowserWindow({
		width: 1400,
		height: 725,
		minWidth: 1000,
		minHeight: 725,
		webPreferences: {
			webSecurity: false,
			nodeIntegration: true
		},
		frame: false
	});

	if (serve) {
		require('electron-reload')(__dirname, {
			electron: require(path.join(__dirname, `../../node_modules/electron`))
		});
		win.webContents.openDevTools();
	}
	win.loadURL('http://localhost:' + port);

	win.on('closed', () => {
		win = null;
	});

}

function startLocalWebServer(): Promise<number> {
	const server = express();
	server.use('/', express.static(path.join(__dirname, '..', 'logigator-editor')));
	return new Promise<number>(resolve => {
		const infos = server.listen(0, 'localhost', () => resolve(infos.address().port));
	});
}

function registerHttpInterceptor() {
	session.defaultSession.webRequest.onBeforeSendHeaders(getHttpFilterUrls(), (details, callback) => {
		if (details.url.includes('api.logigator')) {
			// tslint:disable-next-line:no-string-literal
			details.requestHeaders['Cookie'] = authHandler.cookies;
			// tslint:disable-next-line:no-string-literal
			details.requestHeaders['Origin'] = getDomain();
			// tslint:disable-next-line:no-string-literal
			details.requestHeaders['Referer'] = getDomain() + '/';
		} else {
			details.referrer = 'https://logigator.com';
			// tslint:disable-next-line:no-string-literal
			details.requestHeaders['Referer'] = 'https://logigator.com';
		}

		callback({
			requestHeaders: details.requestHeaders
		});
	});
}
