import { Injectable } from '@angular/core';
import {catchError} from 'rxjs/operators';
import {Observable, of} from 'rxjs';
import {ToastrService} from 'ngx-toastr';

@Injectable({
	providedIn: 'root'
})
export class ErrorHandlingService {

	constructor(private toastr: ToastrService) { }

	public catchErrorOperator<T>(errorMessage: string, toEmit: any) {
		return (source: Observable<T>) => {
			return source.pipe(
				catchError(err => {
					this.showErrorMessage(errorMessage);
					return of(toEmit);
				})
			);
		};
	}

	public catchErrorOperatorDynamicMessage<T>(msgFn: (err: any) => string, toEmit: any) {
		return (source: Observable<T>) => {
			return source.pipe(
				catchError(err => {
					this.showErrorMessage(msgFn(err));
					return of(toEmit);
				})
			);
		};
	}

	public showErrorMessage(message: string) {
		this.toastr.error(message);
		console.error(message);
	}

	public showInfo(message: string) {
		this.toastr.info(message);
		console.log(message);
	}
}
