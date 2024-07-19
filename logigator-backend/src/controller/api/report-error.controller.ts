import {Body, CurrentUser, JsonController, Post, UseInterceptor} from 'routing-controllers';
import {ApiInterceptor} from '../../interceptors/api.interceptor';
import {ReportError} from '../../models/request/api/report-error/report-error';
import {ConfigService} from '../../services/config.service';
import {promises as fs} from 'fs';
import {User} from '../../database/entities/user.entity';
import {EmailService} from '../../services/email.service';
import {StandaloneViewService} from '../../services/standalone-view.service';

@JsonController('/api/report-error')
@UseInterceptor(ApiInterceptor)
export class ReportErrorController {

	constructor(
		private configService: ConfigService,
		private emailService: EmailService,
		private standaloneViewService: StandaloneViewService
	) {}

	@Post('/')
	public async reportError(@Body() body: ReportError, @CurrentUser() user: User) {
		const logToFileEnabled: boolean = this.configService.getConfig<any>('environment').enableErrorReportsFile ?? false;
		const logToEmailEnabled: boolean = this.configService.getConfig<any>('environment').sendErrorReportsAsEmail ?? false;

		if (!logToFileEnabled && !logToEmailEnabled)
			return { success: true };

		let toAppend = `Date: ${new Date().toUTCString()}`;

		if (body.message)
			toAppend += `\nMessage: ${body.message}`;

		if (body.line && body.col)
			toAppend += `\nPosition: ${body.line}:${body.col}`;

		if (body.file)
			toAppend += `\nFile: ${body.file}`;

		if (body.userAgent)
			toAppend += `\nUser Agent: ${body.userAgent}`;

		if (user)
			toAppend += `\nUser: ${user.id} (Username: ${user.username}, Email: ${user.email})`;

		if (body.userMessage)
			toAppend += `\nMessage: ${body.userMessage}`;

		if (body.stack)
			toAppend += `\nStack:\n -${body.stack.replace('\n', '\n -')}`;

		let projectFile: string;
		if (body.project)
			projectFile = JSON.stringify(body.project);

		const adminEmailAddresses: string[] = this.configService.getConfig<any>('environment').adminEmailAddresses;
		if (logToEmailEnabled && adminEmailAddresses) {
			this.standaloneViewService.renderView('admin-email-error-report', {data: toAppend}).then(view => {
				this.emailService.sendMail(
					'noreply',
					adminEmailAddresses,
					'Error Report received',
					view,
					projectFile ? [{filename: 'project.json', content: projectFile}] : []
				);
			});
		}

		const errorLogLocation: string = this.configService.getConfig<any>('environment').reportErrorLogFile;
		if (logToFileEnabled && errorLogLocation) {
			let logFileContents = toAppend;
			if (projectFile)
				logFileContents += `\nProject: ${projectFile}`;
			logFileContents +=	'\n-----------------------------------------------------------------------------------\n';
			await fs.appendFile(errorLogLocation, logFileContents);
		}
		return { success: true };
	}

}
