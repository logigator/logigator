import {Request, Response} from 'express';

export function redirect(req: Request, res: Response, options?: RedirectFuncOptions): Response {
	if (!options) {
		options = {
			target: req.get('Referer') ?? `/${req.cookies.preferences.lang}`
		};
	} else {
		if (options.target) {
			if (options.target === '/') {
				options.target = `/${req.cookies.preferences.lang}`;
			} else {
				options.target = `/${req.cookies.preferences.lang}${options.target}`;
			}
		} else {
			options.target = req.get('Referer') ?? `/${req.cookies.preferences.lang}`;
		}
		if (options.showInfoPopup) {
			req.session.infoPopup = {
				show: options.showInfoPopup,
				data: options.infoPopupData
			};
		}
	}

	res.redirect(options.target);
	return res;
}

export interface RedirectFuncOptions {

	/**
	 * relative redirect target, default: Referer
	 */
	target?: string;

	/**
	 * name of the infoPopup to show ex. `register-local`
	 */
	showInfoPopup?: string;

	/**
	 * will pe passed to infoPopup as (@infoPopupData)
	 */
	infoPopupData?: any;
}
