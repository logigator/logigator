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
			.filter(key => key.startsWith('__') && key.endsWith('__'))
			.forEach(key => {
				if (!key.startsWith('__has_')) {
					const keyToDefine = key.replace(/_/g, '');
					Object.defineProperty(data, keyToDefine, {
						value: data[keyToDefine],
						enumerable: true
					});
				}
				delete data[key];
			});
		return data;
	}
}
