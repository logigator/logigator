import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Transporter } from 'nodemailer';
import { ENV, type Env } from '../config/env';
import type { Locale } from '../common/locale';
import { renderMail, type MailKind } from './mail-template';
import { MAIL_TRANSPORT } from './mail.transport';

export interface MailRecipient {
  email: string;
  username: string;
  locale: Locale;
}

/**
 * Sends the handful of transactional mails the API owns. Callers name an
 * intent, never a template or a URL: the link is built here from the configured
 * public URL, so a token can never be pasted into the wrong path.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: Transporter,
    @Inject(ENV) private readonly env: Env
  ) {}

  /** Confirms a newly registered address. Until it is opened, login is refused. */
  async sendRegistrationVerification(
    recipient: MailRecipient,
    token: string
  ): Promise<void> {
    await this.send(
      'verifyRegistration',
      recipient,
      this.verifyLink(recipient, token)
    );
  }

  /**
   * Confirms an address a signed-in user wants to move to. The account keeps its
   * current address until the link is opened, so a typo cannot lock anyone out.
   */
  async sendEmailChangeVerification(
    recipient: MailRecipient,
    token: string
  ): Promise<void> {
    await this.send(
      'verifyEmailChange',
      recipient,
      this.verifyLink(recipient, token)
    );
  }

  async sendPasswordReset(
    recipient: MailRecipient,
    token: string
  ): Promise<void> {
    await this.send(
      'resetPassword',
      recipient,
      `${this.siteUrl(recipient)}/reset-password?token=${encodeURIComponent(token)}`
    );
  }

  /**
   * Mails a client-side error report to whoever reads them, or does nothing
   * when nobody does. The one mail with no recipient and no locale: it goes to
   * the operator, so the address is configuration. The circuit rides along as
   * an attachment, since inline it would make the body unreadable.
   *
   * @returns whether a mail was sent.
   */
  async sendErrorReport(report: {
    subject: string;
    body: string;
    circuit?: string;
  }): Promise<boolean> {
    return this.sendToOperator({
      subject: report.subject,
      text: report.body,
      attachments: report.circuit
        ? [{ filename: 'circuit.json', content: report.circuit }]
        : []
    });
  }

  /**
   * Mails a report about a document to the same operator address. A reporter
   * who left an address is the reply-to, so answering them is a reply.
   *
   * @returns whether a mail was sent.
   */
  async sendDocumentReport(report: {
    subject: string;
    body: string;
    replyTo?: string;
  }): Promise<boolean> {
    return this.sendToOperator({
      subject: report.subject,
      text: report.body,
      ...(report.replyTo ? { replyTo: report.replyTo } : {})
    });
  }

  private async sendToOperator(mail: {
    subject: string;
    text: string;
    replyTo?: string;
    attachments?: { filename: string; content: string }[];
  }): Promise<boolean> {
    if (!this.env.REPORT_MAIL_TO) return false;

    await this.transport.sendMail({
      from: this.env.MAIL_FROM,
      to: this.env.REPORT_MAIL_TO,
      ...mail,
      // A crash message can be any length, and a subject line cannot.
      subject: mail.subject.slice(0, 160)
    });
    return true;
  }

  /**
   * The site root in the mail's language, so the page a link opens speaks the
   * language the mail was written in rather than whatever the browser asks for.
   */
  private siteUrl(recipient: MailRecipient): string {
    return `${this.env.PUBLIC_URL}/${recipient.locale}`;
  }

  private verifyLink(recipient: MailRecipient, token: string): string {
    return `${this.siteUrl(recipient)}/verify-email/${encodeURIComponent(token)}`;
  }

  private async send(
    kind: MailKind,
    recipient: MailRecipient,
    link: string
  ): Promise<void> {
    const mail = renderMail(kind, recipient.locale, {
      username: recipient.username,
      link,
      linkLifetimeMinutes: this.env.AUTH_TOKEN_TTL_MINUTES,
      publicUrl: this.env.PUBLIC_URL
    });

    const info: unknown = await this.transport.sendMail({
      from: this.env.MAIL_FROM,
      to: recipient.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text
    });

    if (!this.env.SMTP_URL) {
      // Nothing was sent, so the link is the only way to reach the next step.
      this.logger.warn(
        `No SMTP_URL configured — ${kind} mail for ${recipient.email} was not sent. Link: ${link}`
      );
      this.logger.debug(info);
    }
  }
}
