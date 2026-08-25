import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Transporter } from 'nodemailer';
import { ENV, type Env } from '../config/env';
import type { Locale } from '../common/locale';
import { renderMail, type MailKind } from './mail-template';
import { MAIL_TRANSPORT } from './mail.transport';

/** Who the mail goes to, and what to call them. */
export interface MailRecipient {
  email: string;
  username: string;
  locale: Locale;
}

/**
 * Sends the handful of transactional mails the API owns.
 *
 * Callers name an intent, never a template or a URL: the link a mail carries is
 * built here, from the configured public URL, so the paths live in one place and
 * a token can never be pasted into the wrong one.
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
    await this.send('verifyRegistration', recipient, this.verifyLink(token));
  }

  /**
   * Confirms an address a signed-in user wants to move to. The account keeps its
   * current address until the link is opened, so a typo cannot lock anyone out.
   */
  async sendEmailChangeVerification(
    recipient: MailRecipient,
    token: string
  ): Promise<void> {
    await this.send('verifyEmailChange', recipient, this.verifyLink(token));
  }

  async sendPasswordReset(
    recipient: MailRecipient,
    token: string
  ): Promise<void> {
    await this.send(
      'resetPassword',
      recipient,
      `${this.env.PUBLIC_URL}/reset-password?token=${encodeURIComponent(token)}`
    );
  }

  /**
   * Mails a client-side error report to whoever reads them, or does nothing when
   * nobody does.
   *
   * The one mail with no recipient in its signature and no locale: it goes to the
   * operator rather than to a user, so the address is configuration and the
   * language is not a question. It is still an intent rather than a template —
   * the caller says what happened, and where that goes is decided here.
   *
   * The circuit rides along as an attachment. It is the most useful part of a
   * report and the part that would make the body unreadable inline.
   *
   * @returns whether a mail was sent.
   */
  async sendErrorReport(report: {
    subject: string;
    body: string;
    circuit?: string;
  }): Promise<boolean> {
    if (!this.env.REPORT_MAIL_TO) return false;

    await this.transport.sendMail({
      from: this.env.MAIL_FROM,
      to: this.env.REPORT_MAIL_TO,
      // A crash message can be any length, and a subject line cannot.
      subject: report.subject.slice(0, 160),
      text: report.body,
      attachments: report.circuit
        ? [{ filename: 'circuit.json', content: report.circuit }]
        : []
    });
    return true;
  }

  private verifyLink(token: string): string {
    return `${this.env.PUBLIC_URL}/verify-email/${encodeURIComponent(token)}`;
  }

  private async send(
    kind: MailKind,
    recipient: MailRecipient,
    link: string
  ): Promise<void> {
    const mail = renderMail(kind, recipient.locale, {
      username: recipient.username,
      link,
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
      // Nothing was sent: log enough for a developer to follow the flow, link
      // included, since that is the only way to reach the next step locally.
      this.logger.warn(
        `No SMTP_URL configured — ${kind} mail for ${recipient.email} was not sent. Link: ${link}`
      );
      this.logger.debug(info);
    }
  }
}
