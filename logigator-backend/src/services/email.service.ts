import {Service} from 'typedi';
import {ConfigService} from './config.service';
import {createTransport} from 'nodemailer';
import {Attachment} from 'nodemailer/lib/mailer';

@Service()
export class EmailService {

	constructor(private configService: ConfigService) {}

	public async sendMail(account: string, recipients: string[] | string, subject: string, htmlContent: string, attachments?: Attachment[]): Promise<void> {
		const config = this.configService.getConfig('nodemailer')?.[account];
		if (!config) {
			throw new Error('No Nodemailer config found for this account!');
		}

		const mailTransport = createTransport({
			...config.transport,
			connectionTimeout: 10000,
			greetingTimeout: 10000,
			socketTimeout: 10000
		});
		await mailTransport.verify();
		await mailTransport.sendMail({
			from: config.from,
			to: recipients,
			subject: subject,
			html: htmlContent,
			attachments
		});
		mailTransport.close();
	}

}
