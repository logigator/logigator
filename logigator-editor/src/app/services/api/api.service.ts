import {Injectable, Optional} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {ErrorHandlingService} from '../error-handling/error-handling.service';
import {environment} from '../../../environments/environment';
import {from, Observable, ObservableInput} from 'rxjs';
import {ApiError, ApiErrorConfig} from '../../models/api-error-config';
import {catchError, map} from 'rxjs/operators';
import {Response} from '../../models/http/response/response';
import {ElectronService} from 'ngx-electron';

@Injectable({
	providedIn: 'root'
})
export class ApiService {

	constructor(
		private http: HttpClient,
		private errorHandling: ErrorHandlingService,
		@Optional() private electronService: ElectronService
	) {}

	public get<T>(url: string, errorConfig?: ApiErrorConfig, params?: { [param: string]: string; }): Observable<Response<T>> {
		// #!if ELECTRON === 'false'
		return this.http.get<T>(environment.api + url, {params}).pipe(
			catchError(err => this.handleError(err, errorConfig))
		);
		// #!else
		return from(this.electronService.ipcRenderer.invoke('api-get', environment.api + url, params)).pipe(
			map(resp => this.mapElectronResponse(resp, errorConfig))
		);
		// #!endif
	}

	public post<T>(url: string, body: any, errorConfig?: ApiErrorConfig, params?: { [param: string]: string; }): Observable<Response<T>> {
		// #!if ELECTRON === 'false'
		return this.http.post<T>(environment.api + url, body, {params}).pipe(
			catchError(err => this.handleError(err, errorConfig))
		);
		// #!else
		return from(this.getElectronIpcCall('api-post', environment.api + url, body, params)).pipe(
			map(resp => this.mapElectronResponse(resp, errorConfig))
		);
		// #!endif
	}

	public put<T>(url: string, body: any, errorConfig?: ApiErrorConfig, params?: { [param: string]: string; }): Observable<Response<T>> {
		// #!if ELECTRON === 'false'
		return this.http.put<T>(environment.api + url, body, {params}).pipe(
			catchError(err => this.handleError(err, errorConfig))
		);
		// #!else
		return from(this.getElectronIpcCall('api-put', environment.api + url, body, params)).pipe(
			map(resp => this.mapElectronResponse(resp, errorConfig))
		);
		// #!endif
	}

	public patch<T>(url: string, body: any, errorConfig?: ApiErrorConfig, params?: { [param: string]: string; }): Observable<Response<T>> {
		// #!if ELECTRON === 'false'
		return this.http.patch<T>(environment.api + url, body, {params}).pipe(
			catchError(err => this.handleError(err, errorConfig))
		);
		// #!else
		return from(this.getElectronIpcCall('api-patch', environment.api + url, body, params)).pipe(
			map(resp => this.mapElectronResponse(resp, errorConfig))
		);
		// #!endif
	}

	public delete<T>(url: string, errorConfig?: ApiErrorConfig, params?: { [param: string]: string; }): Observable<Response<T>> {
		// #!if ELECTRON === 'false'
		return this.http.delete<T>(environment.api + url, {params}).pipe(
			catchError(err => this.handleError(err, errorConfig))
		);
		// #!else
		return from(this.electronService.ipcRenderer.invoke('api-delete', environment.api + url, params)).pipe(
			map(resp => this.mapElectronResponse(resp, errorConfig))
		);
		// #!endif
	}

	private mapElectronResponse(resp: any, errorConfig: ApiErrorConfig): any {
		if (resp.ok) {
			return resp.response;
		} else {
			this.handleError({
				ok: resp.ok,
				error: resp.response,
				status: resp.status,
				statusText: resp.statusText,
				url: resp.url
			}, errorConfig);
		}
	}

	private getElectronIpcCall(channel: string, url: string, body: any, params?: { [param: string]: string; }): Promise<any> {
		return new Promise<any>(async resolve => {
			let bodyForIpc: object;
			if (body instanceof FormData) {
				const serialized: Promise<any>[] = [];
				body.forEach((value, key) => {
					if (value instanceof File) {
						serialized.push(new Promise<any>(async resolveFormField => resolveFormField({
							key, mimetype: value.type, value: await value.arrayBuffer()
						})));
					} else {
						serialized.push(Promise.resolve({key, value}));
					}
				});
				bodyForIpc = {
					type: 'formdata',
					body: await Promise.all(serialized)
				};
			} else {
				bodyForIpc = {
					type: 'json',
					body
				};
			}
			resolve(await this.electronService.ipcRenderer.invoke(channel, url, bodyForIpc, params));
		});
	}

	private handleError(err: ApiError, errorConfig?: ApiErrorConfig): ObservableInput<any> {
		if (!errorConfig) {
			throw err;
		}

		const errorMsg = errorConfig?.dynamicMsg ? errorConfig.dynamicMsg(err) : errorConfig.errorMessage;
		if (errorMsg) {
			this.errorHandling.showErrorMessage(errorMsg, errorConfig?.translationParams);
		}
		throw err;
	}
}
