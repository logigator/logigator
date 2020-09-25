import {Action, InterceptorInterface} from 'routing-controllers';
import {Response} from 'express';

export class ApiInterceptor implements InterceptorInterface {

	intercept(action: Action, result: any): any | Promise<any> {
		return {
			status: (action.response as Response).statusCode,
			data: result || {}
		};
	}
}
