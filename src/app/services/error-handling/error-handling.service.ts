import { Injectable } from '@angular/core';
import {catchError} from 'rxjs/operators';
import {Observable, of} from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class ErrorHandlingService {

	constructor() { }

	public catchErrorOperator<T>(errorMessage: string, toEmit: any) {
		return (source: Observable<T>) => {
			return source.pipe(
				catchError(err => {
					console.error(errorMessage);
					return of(toEmit);
				})
			);
		};
	}

	public catchErrorOperatorDynamicMessage<T>(msgFn: (err: any) => string, toEmit: any) {
		return (source: Observable<T>) => {
			return source.pipe(
				catchError(err => {
					console.error(msgFn(err));
					return of(toEmit);
				})
			);
		};
	}
}
