import { ipcMain, BrowserWindow, Event } from 'electron';
import fetch from 'node-fetch';
import {getApiUrl} from './utils';
import {Storage} from './storage';
import {AuthUrlResponse} from './models/AuthUrlResponse';
import {URL, URLSearchParams} from 'url';

export class AuthenticationHandler {

	public initListeners() {
		ipcMain.on('login', () => this.onLogin());
		ipcMain.on('register', () => this.onRegister());
		ipcMain.on('logout', () => this.onLogout());
	}

	private async onLogin() {
	}

	private async onRegister() {

	}

	private onLogout() {

	}
}
