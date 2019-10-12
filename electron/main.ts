import {BrowserWindow, app, protocol} from 'electron';
import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';

const args = process.argv.slice(1);
const serve = args.some(val => val === '--serve');

let win: BrowserWindow;

try {
	app.on('ready', () => {
		if (!serve) registerProtocols();
		createWindow();
	});

	app.on('window-all-closed', () => {
		if (process.platform !== 'darwin') {
			app.quit();
		}
	});

	app.on('activate', () => {
		if (win === null) {
			createWindow();
		}
	});

} catch (e) {
	console.error(e);
	process.exit(1);
}

function createWindow() {
	win = new BrowserWindow({
		width: 1000,
		height: 725,
		minWidth: 1000,
		minHeight: 725,
		webPreferences: {
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

function registerProtocols() {
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
