import {createParamDecorator} from 'routing-controllers';
import {Request} from 'express';

export function Referer() {
	return createParamDecorator({
		value: action => {
			return (action.request as Request).get('Referer');
		}
	});
}
