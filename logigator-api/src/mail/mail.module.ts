import { Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { MailService } from './mail.service';
import { createMailTransport, MAIL_TRANSPORT } from './mail.transport';

/**
 * Three mails is the whole surface, so this is nodemailer plus rendering
 * functions — no template engine, no view directory.
 */
@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [ENV],
      useFactory: (env: Env) => createMailTransport(env)
    },
    MailService
  ],
  exports: [MailService]
})
export class MailModule {}
