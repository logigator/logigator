import { Injectable } from '@angular/core';
import {catchError} from 'rxjs/operators';
import {Observable, of} from 'rxjs';
import {ToastContainerDirective, ToastrService} from 'ngx-toastr';
import {TranslateService} from '@ngx-translate/core';

@Injectable({
	providedIn: 'root'
})
export class ErrorHandlingService {

	constructor(
		private toastr: ToastrService,
		private translate: TranslateService
	) { }

	/**
	 * @deprecated
	 */
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

	/**
	 * @deprecated
	 */
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

	/**
	 * @deprecated
	 */
	public showErrorMessageOnErrorDynamicMessage<T>(msgFn: (err: any) => string) {
		return (source: Observable<T>) => {
			return source.pipe(
				catchError(err => {
					this.showErrorMessage(msgFn(err));
					throw err;
				})
			);
		};
	}

	public showErrorMessage(message: string, translationParams?: any) {
		this.translate.get(message, translationParams).subscribe((res: string) => {
			this.toastr.error(res);
			console.error(res);
		});
	}

	public showInfo(message: string, translationParams?: any) {
		this.translate.get(message, translationParams).subscribe((res: string) => {
			this.toastr.info(res);
			console.log(res);
		});

	}

	public setToastrContainer(cont: ToastContainerDirective) {
		this.toastr.overlayContainer = cont;
	}
}
