import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SendMailOptions, Transporter } from 'nodemailer';
import type { DocumentReportReason } from '@logigator/contract';
import { ENV, type Env } from '../config/env';
import type { Locale } from '../common/locale';
import { Metrics } from '../metrics/metrics';
import { MAIL_STRINGS } from './mail-strings';
import { renderMail, type MailKind } from './mail-template';
import { MAIL_TRANSPORT } from './mail.transport';

export interface MailRecipient {
  email: string;
  username: string;
  locale: Locale;
}

/** The document a moderation mail is about, as its owner knows it. */
export interface ModeratedDocument {
  kind: 'project' | 'component';
  link: string;
  name: string;
}

/**
 * Why a document was hidden, as its owner is told: a moderator's own words,
 * or the category of the machine's verdict, worded by the mail itself.
 */
export type HideReason =
  | { by: 'moderator'; reason: string }
  | { by: 'machine'; category: DocumentReportReason };

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
    @Inject(ENV) private readonly env: Env,
    private readonly metrics: Metrics
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
   * Tells a document's owner it was taken out of the community, and why.
   * Objecting is a reply to the contact address, the one the wording names.
   */
  async sendDocumentHidden(
    recipient: MailRecipient,
    document: ModeratedDocument,
    hide: HideReason
  ): Promise<void> {
    await this.send(
      hide.by === 'machine' ? 'documentHiddenAutomatically' : 'documentHidden',
      recipient,
      this.documentLink(recipient, document),
      {
        values: {
          name: document.name,
          reason:
            hide.by === 'machine'
              ? MAIL_STRINGS[recipient.locale].hiddenReasons[hide.category]
              : hide.reason
        }
      }
    );
  }

  /** Tells a document's owner it is back in the community. */
  async sendDocumentUnhidden(
    recipient: MailRecipient,
    document: ModeratedDocument
  ): Promise<void> {
    await this.send(
      'documentUnhidden',
      recipient,
      this.documentLink(recipient, document),
      { values: { name: document.name } }
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

    // A crash message can be any length, and a subject line cannot.
    const subject = mail.subject.slice(0, 160);
    const info = await this.deliver('operator', {
      from: this.env.MAIL_FROM,
      to: this.env.REPORT_MAIL_TO,
      ...mail,
      subject
    });

    if (!this.env.SMTP_URL) {
      this.logger.warn({
        kind: 'operator',
        to: this.env.REPORT_MAIL_TO,
        subject,
        msg: 'No SMTP_URL configured, so the operator mail was not sent'
      });
      this.logger.debug(info);
    }
    return true;
  }

  /**
   * The site root in the mail's language, so the page a link opens speaks the
   * language the mail was written in rather than whatever the browser asks for.
   */
  private siteUrl(recipient: MailRecipient): string {
    return `${this.env.PUBLIC_URL}/${recipient.locale}`;
  }

  /** The document's community page, which resolves for its owner even hidden. */
  private documentLink(
    recipient: MailRecipient,
    document: ModeratedDocument
  ): string {
    return `${this.siteUrl(recipient)}/community/${document.kind}s/${document.link}`;
  }

  private verifyLink(recipient: MailRecipient, token: string): string {
    return `${this.siteUrl(recipient)}/verify-email/${encodeURIComponent(token)}`;
  }

  private async send(
    kind: MailKind,
    recipient: MailRecipient,
    link: string,
    options: { values?: Record<string, string> } = {}
  ): Promise<void> {
    const { values } = options;
    const mail = renderMail(kind, recipient.locale, {
      username: recipient.username,
      link,
      linkLifetimeMinutes: this.env.AUTH_TOKEN_TTL_MINUTES,
      publicUrl: this.env.PUBLIC_URL,
      ...(values ? { values } : {})
    });

    const info = await this.deliver(kind, {
      from: this.env.MAIL_FROM,
      to: recipient.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      ...(this.env.MAIL_REPLY_TO ? { replyTo: this.env.MAIL_REPLY_TO } : {})
    });

    if (!this.env.SMTP_URL) {
      // Nothing was sent, so the link is the only way to reach the next step.
      this.logger.warn({
        kind,
        to: recipient.email,
        link,
        msg: 'No SMTP_URL configured, so the mail was not sent'
      });
      this.logger.debug(info);
    }
  }

  /**
   * Hands one mail to the transport and counts what became of it. Without
   * `SMTP_URL` the transport only echoes the message, so that is `skipped`
   * and no outbound call.
   */
  private async deliver(
    kind: MailKind | 'operator',
    message: SendMailOptions
  ): Promise<unknown> {
    let info: unknown;
    try {
      info = this.env.SMTP_URL
        ? await this.metrics.timeOutbound('smtp', () =>
            this.transport.sendMail(message)
          )
        : await this.transport.sendMail(message);
    } catch (error) {
      this.metrics.mails.inc({ kind, outcome: 'failed' });
      throw error;
    }
    this.metrics.mails.inc({
      kind,
      outcome: this.env.SMTP_URL ? 'sent' : 'skipped'
    });
    return info;
  }
}
