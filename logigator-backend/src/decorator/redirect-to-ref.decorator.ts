import {createParamDecorator} from 'routing-controllers';
import {Request, Response} from 'express';

export function RedirectToRef() {
	return createParamDecorator({
		value: (action): RedirectFunc => {
			return (options?: RedirectFuncOptions) => {

				if (options?.showSuccessPopup) {
					(action.request as Request).session.successPopup = {
						show: options.showSuccessPopup,
						data: options.successPopupData
					};
				}

				const resp = (action.response as Response);
				resp.redirect((action.request as Request).get('Referer'));
				return resp;
			};
		}
	});
}

export type RedirectFunc = (options?: RedirectFuncOptions) => Response;

export interface RedirectFuncOptions {

	/**
	 * name of the successPopup to show ex. `register-local`
	 */
	showSuccessPopup?: string;

	/**
	 * will pe passed to successPopup
	 */
	successPopupData?: any;
}
