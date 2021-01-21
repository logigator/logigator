import {Body, JsonController, Post, UseInterceptor} from 'routing-controllers';
import {ApiInterceptor} from '../../interceptors/api.interceptor';
import {ReportError} from '../../models/request/api/report-error/report-error';
import {ConfigService} from '../../services/config.service';
import * as path from 'path';
import {promises as fs} from 'fs';

@JsonController('/api/report-error')
@UseInterceptor(ApiInterceptor)
export class ReportErrorController {

	constructor(private configService: ConfigService) {}

	@Post('/')
	public async reportError(@Body() body: ReportError) {
		const errorLogLocation = path.join(this.configService.projectRootPath, this.configService.getConfig<any>('environment').reportErrorLog);
		const toAppend = new Date().toUTCString() +
			`\n${body.message}` +
			`\n${body.stack}` +
			`\n${body.userMessage}` +
			'\n-----------------------------------------------------------------------------------\n';

		await fs.appendFile(errorLogLocation, toAppend);

		return { success: true };
	}

}
