import {createParamDecorator} from 'routing-controllers';
import {Response} from 'express';
import {redirect, RedirectFuncOptions} from '../functions/redirect';

export function Redirect() {
	return createParamDecorator({
		value: (action): RedirectFunction => (options?: RedirectFuncOptions) => {
			return redirect(action.request, action.response, options);
		}
	});
}

export type RedirectFunction = (options?: RedirectFuncOptions) => Response;
