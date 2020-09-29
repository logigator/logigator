import {createParamDecorator} from 'routing-controllers';
import {Request} from 'express';

export function Preferences() {
	return createParamDecorator({
		value: action => {
			return (action.request as Request).cookies['preferences'] ?? {};
		}
	});
}
