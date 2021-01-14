import {Body, JsonController, Post, UseInterceptor} from 'routing-controllers';
import {ApiInterceptor} from '../../interceptors/api.interceptor';
import {ReportError} from '../../models/request/api/report-error/report-error';

@JsonController('/api/report-error')
@UseInterceptor(ApiInterceptor)
export class ReportErrorController {

	@Post('/')
	public reportError(@Body() body: ReportError) {
		console.log(body);

		return { success: true };
	}

}
