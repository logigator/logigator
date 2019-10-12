import { ipcMain, WebContents, BrowserWindow} from 'electron';
import fetch from 'node-fetch';
import {getApiUrl} from './utils';
import {AuthUrlResponse} from './models/AuthUrlResponse';

export class AuthenticationHandler {

	private _mainWindow: BrowserWindow;

	constructor() {
	}

	public initLoginListeners(mainWindow: BrowserWindow) {
		this._mainWindow = mainWindow;
		ipcMain.on('logingoogle', () => this.onGoogleLogin());
		ipcMain.on('logintwitter', () => this.onTwitterLogin());
		ipcMain.on('loginemail', (event, args) => this.onEmailLogin(args));
	}

	private async onGoogleLogin() {
		try {
			const url = await this.getSocialLoginUrl('google');
			const win = this.openSocialLoginPopupWindow(url);
			win.webContents.on('will-navigate', (event, redirectUrl: string) => {

			});
		} catch (e) {
			this.sendLoginResponse(false, 'google');
		}
	}

	private async onTwitterLogin() {
		try {
			const url = await this.getSocialLoginUrl('twitter');
			const win = this.openSocialLoginPopupWindow(url);
			win.webContents.on('will-navigate', (event, redirectUrl: string) => {

			});
		} catch (e) {
			this.sendLoginResponse(false, 'twitter');
		}
	}

	private async onEmailLogin(args: {email: string, password: string}) {
	}

	private async getSocialLoginUrl(type: 'google' | 'twitter'): Promise<string> {
		const resp = await fetch(getApiUrl() + `/auth/${type}-auth-url`);
		const data = await resp.json() as AuthUrlResponse;
		return data.result.url;
	}

	private sendLoginResponse(succeeded: boolean, type: 'google' | 'twitter' | 'email') {
		this._mainWindow.webContents.send('login' + type + 'Response', succeeded ? 'success' : undefined);
	}

	private openSocialLoginPopupWindow(url: string): BrowserWindow {
		const win = new BrowserWindow({
			width: 450,
			height: 620,
			parent: this._mainWindow,
			modal: true,
			resizable: false,
			minimizable: false,
			maximizable: false,
			webPreferences: {
				devTools: false,
				nodeIntegration: false
			}
		});
		win.loadURL(url);
		win.setMenu(null);
		win.setMenuBarVisibility(false);
		return win;
	}

	public get isLoggedIn(): boolean {
		return true;
	}
}
