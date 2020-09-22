import {createParamDecorator} from 'routing-controllers';
import {Request, Response} from 'express';

export function RedirectToRef() {
	return createParamDecorator({
		value: action => {
			return () => {
				const resp = (action.response as Response);
				resp.redirect((action.request as Request).get('Referer'));
				return resp;
			};
		}
	});
}
