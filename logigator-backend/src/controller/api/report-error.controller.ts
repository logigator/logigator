import {Body, CurrentUser, JsonController, Post, UseBefore, UseInterceptor} from 'routing-controllers';
import {ApiInterceptor} from '../../interceptors/api.interceptor';
import {ReportError} from '../../models/request/api/report-error/report-error';
import {ConfigService} from '../../services/config.service';
import {promises as fs} from 'fs';
import {User} from '../../database/entities/user.entity';
import {EmailService} from '../../services/email.service';
import {StandaloneViewService} from '../../services/standalone-view.service';
import {ReportRateLimitMiddleware} from '../../middleware/rate-limit/report-rate-limit.middleware';

@JsonController('/api/report-error')
@UseInterceptor(ApiInterceptor)
@UseBefore(ReportRateLimitMiddleware)
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
		toAppend += `\nSource: ${body.source ?? 'editor-v1'}`;

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

		const client = body.client;
		if (client) {
			if (client.browser)
				toAppend += `\nBrowser: ${client.browser}`;
			if (client.os)
				toAppend += `\nOS: ${client.os}`;
			if (client.renderingContext)
				toAppend += `\nRendering: ${client.renderingContext}`;
			if (client.gpu)
				toAppend += `\nGPU: ${client.gpu}`;
			if (client.windowSize)
				toAppend += `\nWindow: ${client.windowSize}`;
			if (client.screenSize)
				toAppend += `\nScreen: ${client.screenSize}`;
			if (client.devicePixelRatio)
				toAppend += `\nDevice Pixel Ratio: ${client.devicePixelRatio}`;
			if (client.locale)
				toAppend += `\nLocale: ${client.locale}`;
			if (client.url)
				toAppend += `\nURL: ${client.url}`;
			if (client.workMode)
				toAppend += `\nWork Mode: ${client.workMode}`;
			if (client.simulationRunning !== undefined)
				toAppend += `\nSimulation Running: ${client.simulationRunning}`;
			if (client.touch !== undefined)
				toAppend += `\nTouch: ${client.touch}`;
		}

		if (body.userMessage)
			toAppend += `\nUser Message: ${body.userMessage}`;

		if (body.logs)
			toAppend += `\nRecent Logs:\n${body.logs}`;

		if (body.stack)
			toAppend += `\nStack:\n -${body.stack.replace(/\n/g, '\n -')}`;

		let projectFile: string;
		if (body.project)
			projectFile = JSON.stringify(body.project);
		else if (body.projectDump)
			projectFile = body.projectDump;

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
