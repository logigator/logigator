import {ipcMain, BrowserWindow, Cookie} from 'electron';
import {getHomeDomain, getHomeUrl} from './utils';
import {Storage} from './storage';

export class AuthenticationHandler {

	private readonly _window: BrowserWindow;

	private _currentlyLoggingIn = false;

	private _sessionCookie: string;

	constructor(win: BrowserWindow) {
		this._window = win;
		this.readLoginState();
	}

	public initListeners() {
		ipcMain.handle('login', () => this.onLogin());
		ipcMain.handle('logout', () => this.onLogout());
	}

	public get isAuthenticated(): boolean {
		return !!this._sessionCookie;
	}

	public get sessionCookie(): string {
		return this._sessionCookie;
	}

	private async onLogin() {
		if (this._currentlyLoggingIn || this.isAuthenticated) return;

		this._currentlyLoggingIn = true;
		let loginWin = new BrowserWindow({
			width: 480,
			height: 620,
			parent: this._window,
			modal: true,
			resizable: false,
			minimizable: false,
			maximizable: false,
			webPreferences: {
				devTools: true,
				nodeIntegration: false,
				enableRemoteModule: false,
				worldSafeExecuteJavaScript: true
			}
		});
		loginWin.setMenu(null);
		loginWin.setMenuBarVisibility(false);
		await loginWin.webContents.session.cookies.remove(getHomeUrl(), 'isAuthenticated');
		await loginWin.webContents.session.cookies.remove(getHomeUrl(), 'connect.sid');
		await loginWin.loadURL(getHomeUrl() + '/login-electron');

		loginWin.webContents.on('did-navigate', async (event, url) => {
			const cookies = await loginWin.webContents.session.cookies.get({domain: getHomeDomain()});
			if (url.startsWith(getHomeUrl()) && cookies.find(c => c.name === 'isAuthenticated')?.value === 'true') {
				this.setLoginSate(true, cookies.find(c => c.name === 'connect.sid'));
				this._currentlyLoggingIn = false;
				loginWin.close();
			}
		});

		loginWin.on('closed', () => {
			this._currentlyLoggingIn = false;
			loginWin = null;
		});
	}

	private onLogout() {
		this.setLoginSate(false);
	}

	private setLoginSate(state: boolean, cookie?: Cookie) {
		if (state) {
			this._window.webContents.executeJavaScript(`window.localStorage.setItem('isAuthenticated', 'true')`);

			const sessionCookie = `connect.sid=${cookie.value}`;

			Storage.getInstance().set('sessionCookie', sessionCookie);
			Storage.getInstance().set('sessionCookieExpires', cookie.expirationDate * 1000);

			this._sessionCookie = sessionCookie;
		} else {
			this._window.webContents.executeJavaScript(`window.localStorage.removeItem('isAuthenticated')`);
			delete this._sessionCookie;
			Storage.getInstance().remove('sessionCookie');
			Storage.getInstance().remove('sessionCookieExpires');
		}
	}

	private readLoginState() {
		if (Storage.getInstance().has('sessionCookie') && Storage.getInstance().has('sessionCookieExpires')) {
			const expirationDate = Number(Storage.getInstance().get('sessionCookieExpires'));

			if (expirationDate >= Date.now()) {
				this._sessionCookie = Storage.getInstance().get('sessionCookie');
				this._window.webContents.executeJavaScript(`window.localStorage.setItem('isAuthenticated', 'true')`);
			} else {
				this.setLoginSate(false);
			}
		} else {
			this.setLoginSate(false);
		}
	}
}
