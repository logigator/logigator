import {BrowserWindow, app, protocol, session} from 'electron';
import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';
import {AuthenticationHandler} from './authentication-handler';
import {getDomain, getHttpFilterSetCookie} from './utils';

const args = process.argv.slice(1);
const serve = args.some(val => val === '--serve');

let win: BrowserWindow;
let authHandler: AuthenticationHandler;

try {
	authHandler = new AuthenticationHandler();

	app.on('ready', () => {
		if (!serve) registerFileProtocols();

		registerHttpInterceptor();
		authHandler.readSavedLoginState();
		createWindow();
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

function createWindow() {
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
		win.loadURL('http://localhost:8202');
	} else {
		win.loadURL(url.format({
			pathname: path.join(__dirname, '../logigator-editor/index.html'),
			protocol: 'file:',
			slashes: true
		}));
	}

	win.on('closed', () => {
		win = null;
	});

}

function registerFileProtocols() {
	protocol.registerBufferProtocol('jsmod', (request, callback) => {
		fs.readFile(path.join(__dirname, '..', 'logigator-editor', request.url.replace('jsmod://', '').replace(/\/$/, '')), (err, data) => {
			callback({
				mimeType: 'text/javascript',
				data
			});
		});
	});
	protocol.interceptFileProtocol('file', (request, callback) => {
		if (!request.url.includes('assets')) {
			callback(request.url.replace('file:///', ''));
			return;
		}
		const requestedFile = request.url.substr(request.url.indexOf('/assets'));
		callback(path.join(__dirname, '..', 'logigator-editor', requestedFile));
	});
}

function registerHttpInterceptor() {
	session.defaultSession.webRequest.onBeforeSendHeaders(getHttpFilterSetCookie(), (details, callback) => {
		// tslint:disable-next-line:no-string-literal
		details.requestHeaders['Cookie'] = authHandler.cookies;
		// tslint:disable-next-line:no-string-literal
		details.requestHeaders['Origin'] = getDomain();
		// tslint:disable-next-line:no-string-literal
		details.requestHeaders['Referer'] = getDomain() + '/';

		callback({
			requestHeaders: details.requestHeaders
		});
	});
}
