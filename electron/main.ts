import {BrowserWindow, app} from 'electron';
import * as path from 'path';
import * as url from 'url';

const args = process.argv.slice(1);
const serve = args.some(val => val === '--serve');

let win: BrowserWindow;

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
			pathname: path.join(__dirname, '../../dist/index.html'),
			protocol: 'file:',
			slashes: true
		}));
	}

	win.on('closed', () => {
		win = null;
	});

}

try {
	app.on('ready', createWindow);

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
