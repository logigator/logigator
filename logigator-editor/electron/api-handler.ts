import {ipcMain, IpcMainInvokeEvent} from 'electron';
import fetch, {Response, Headers, BodyInit} from 'node-fetch';
import {URL} from 'url';
import {AuthenticationHandler} from './authentication-handler';
import {getHomeUrl} from './utils';
import * as FormData from 'form-data';

export class ApiHandler {

	private readonly _authenticationHandler: AuthenticationHandler;

	constructor(authHandler: AuthenticationHandler) {
		this._authenticationHandler = authHandler;
	}

	public initListeners() {
		ipcMain.handle('api-get', this.onApiGet.bind(this));
		ipcMain.handle('api-post', this.onApiPost.bind(this));
		ipcMain.handle('api-put', this.onApiPut.bind(this));
		ipcMain.handle('api-patch', this.onApiPatch.bind(this));
		ipcMain.handle('api-delete', this.onApiDelete.bind(this));
	}

	private async onApiGet(event: IpcMainInvokeEvent, url: string, params: { [param: string]: string; }): Promise<object> {
		this.checkUrl(url);
		return this.handleResponse(await fetch(this.buildUrl(url, params), {
			method: 'GET',
			headers: this.getRequestHeaders()
		}));
	}

	private async onApiPost(event: IpcMainInvokeEvent, url: string, body: any, params: { [param: string]: string; }) {
		this.checkUrl(url);
		const headers = this.getRequestHeaders();
		const reqBody = this.getRequestBody(body, headers);
		return this.handleResponse(await fetch(this.buildUrl(url, params), {
			method: 'POST',
			body: reqBody,
			headers
		}));
	}

	private async onApiPut(event: IpcMainInvokeEvent, url: string, body: any, params: { [param: string]: string; }) {
		this.checkUrl(url);
		const headers = this.getRequestHeaders();
		const reqBody = this.getRequestBody(body, headers);
		return this.handleResponse(await fetch(this.buildUrl(url, params), {
			method: 'PUT',
			body: reqBody,
			headers
		}));
	}

	private async onApiPatch(event: IpcMainInvokeEvent, url: string, body: any, params: { [param: string]: string; }) {
		this.checkUrl(url);
		const headers = this.getRequestHeaders();
		const reqBody = this.getRequestBody(body, headers);
		return this.handleResponse(await fetch(this.buildUrl(url, params), {
			method: 'PATCH',
			body: reqBody,
			headers
		}));
	}

	private async onApiDelete(event: IpcMainInvokeEvent, url: string, params: { [param: string]: string; }) {
		this.checkUrl(url);
		return this.handleResponse(await fetch(this.buildUrl(url, params), {
			method: 'DELETE',
			headers: this.getRequestHeaders()
		}));
	}

	private async handleResponse(response: Response): Promise<object> {
		try {
			const json = await response.json();
			return {
				response: json,
				ok: response.ok,
				status: response.status,
				url: response.url,
				statusText: response.statusText
			};
		} catch {
			return {
				response: '',
				ok: response.ok,
				status: response.status,
				url: response.url,
				statusText: response.statusText
			};
		}
	}

	private buildUrl(url: string, params: { [param: string]: string; }): string {
		const urlWithParams = new URL(url);
		for (const param in params) {
			urlWithParams.searchParams.append(param, params[param]);
		}
		return urlWithParams.href;
	}

	private getRequestBody(body: any, headers: Headers): BodyInit {
		if (body.type === 'json') {
			headers.set('Content-Type', 'application/json');
			return JSON.stringify(body.body);
		}
		const formData = new FormData();
		for (const {key, value, mimetype} of body.body) {
			if (value instanceof ArrayBuffer) {
				formData.append(key, Buffer.from(value), {contentType: mimetype, filename: 'blob'});
			} else {
				formData.append(key, value);
			}
		}
		headers.set('Content-Type', `multipart/form-data; boundary=${formData.getBoundary()}`);
		return formData;
	}

	private getRequestHeaders(): Headers {
		const headers = new Headers();

		if (this._authenticationHandler.isAuthenticated) {
			headers.append('Cookie', this._authenticationHandler.sessionCookie);
		}

		return headers;
	}

	private checkUrl(url: string) {
		if (!url.startsWith(getHomeUrl())) {
			throw Error(`${url} does not point to Logigator.`);
		}
	}

}
