import { Injectable } from '@angular/core';
import { ToastContainerDirective, ToastrService } from 'ngx-toastr';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
	providedIn: 'root'
})
export class ErrorHandlingService {
	constructor(
		private toastr: ToastrService,
		private translate: TranslateService
	) {}

	public showErrorMessage(message: string, translationParams?: object) {
		this.translate.get(message, translationParams).subscribe((res: string) => {
			this.toastr.error(res);
			console.error(res);
		});
	}

	public showInfo(message: string, translationParams?: object) {
		this.translate.get(message, translationParams).subscribe((res: string) => {
			this.toastr.info(res);
			console.log(res);
		});
	}

	public setToastrContainer(cont: ToastContainerDirective) {
		this.toastr.overlayContainer = cont;
	}
}
