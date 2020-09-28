import {Action, InterceptorInterface} from 'routing-controllers';
import {Response} from 'express';

export class ApiInterceptor implements InterceptorInterface {

	intercept(action: Action, result: any): any | Promise<any> {
		return {
			status: (action.response as Response).statusCode,
			data: result || {}
		};
	}

	private static applyORMCache(data: any): any {
		Object.keys(data)
			.filter(x => x.startsWith('__') && x.endsWith('__'))
			.forEach(x => {
				if (!x.startsWith('__has_'))
					data[x.replace(/_/g, '') + ''] = data[x];
				// delete data[x];
			});
		console.log(data);
		return data;
	}
}
