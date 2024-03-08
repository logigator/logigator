import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ErrorHandlingService } from '../error-handling/error-handling.service';
import { environment } from '../../../environments/environment';
import { Observable, ObservableInput } from 'rxjs';
import { ApiError, ApiErrorConfig } from '../../models/api-error-config';
import { catchError } from 'rxjs/operators';
import { Response } from '../../models/http/response/response';

@Injectable({
	providedIn: 'root'
})
export class ApiService {
	constructor(
		private http: HttpClient,
		private errorHandling: ErrorHandlingService
	) {}

	public get<T>(
		url: string,
		errorConfig?: ApiErrorConfig,
		params?: { [param: string]: string }
	): Observable<Response<T>> {
		return this.http
			.get<T>(environment.api + url, { params })
			.pipe(catchError((err) => this.handleError(err, errorConfig)));
	}

	public post<T>(
		url: string,
		body: unknown,
		errorConfig?: ApiErrorConfig,
		params?: { [param: string]: string }
	): Observable<Response<T>> {
		return this.http
			.post<T>(environment.api + url, body, { params })
			.pipe(catchError((err) => this.handleError(err, errorConfig)));
	}

	public put<T>(
		url: string,
		body: unknown,
		errorConfig?: ApiErrorConfig,
		params?: { [param: string]: string }
	): Observable<Response<T>> {
		return this.http
			.put<T>(environment.api + url, body, { params })
			.pipe(catchError((err) => this.handleError(err, errorConfig)));
	}

	public patch<T>(
		url: string,
		body: unknown,
		errorConfig?: ApiErrorConfig,
		params?: { [param: string]: string }
	): Observable<Response<T>> {
		return this.http
			.patch<T>(environment.api + url, body, { params })
			.pipe(catchError((err) => this.handleError(err, errorConfig)));
	}

	public delete<T>(
		url: string,
		errorConfig?: ApiErrorConfig,
		params?: { [param: string]: string }
	): Observable<Response<T>> {
		return this.http
			.delete<T>(environment.api + url, { params })
			.pipe(catchError((err) => this.handleError(err, errorConfig)));
	}

	private handleError(
		err: ApiError,
		errorConfig?: ApiErrorConfig
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	): ObservableInput<any> {
		if (!errorConfig) {
			throw err;
		}

		const errorMsg = errorConfig?.dynamicMsg
			? errorConfig.dynamicMsg(err)
			: errorConfig.errorMessage;
		if (errorMsg) {
			this.errorHandling.showErrorMessage(
				errorMsg,
				errorConfig?.translationParams
			);
		}
		throw err;
	}
}
