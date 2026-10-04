import type { Transporter } from 'nodemailer';

export interface CapturedMail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** What rode along beside the body — an error report's circuit. */
  attachments: { filename: string; content: string }[];
}

/**
 * Stands in for the nodemailer transport so specs can read what was sent —
 * including that it went to the right address, which digging the token out of
 * Redis would never assert. The token is recovered from the link, as a
 * recipient would.
 */
export class MailCapture {
  readonly sent: CapturedMail[] = [];

  /**
   * Makes the next send reject: a password reset must answer a known and an
   * unknown address identically even when the mail server is down.
   */
  failNextSend = false;

  /** `sendMail` is the only method `MailService` calls on a transport. */
  readonly transport = {
    sendMail: (message: {
      to?: unknown;
      subject?: unknown;
      html?: unknown;
      text?: unknown;
      attachments?: { filename?: unknown; content?: unknown }[];
    }) => {
      if (this.failNextSend) {
        this.failNextSend = false;
        return Promise.reject(new Error('SMTP unavailable'));
      }

      this.sent.push({
        to: String(message.to ?? ''),
        subject: String(message.subject ?? ''),
        html: String(message.html ?? ''),
        text: String(message.text ?? ''),
        attachments: (message.attachments ?? []).map((attachment) => ({
          filename: String(attachment.filename ?? ''),
          content: String(attachment.content ?? '')
        }))
      });
      return Promise.resolve({ accepted: [message.to] });
    }
  } as unknown as Transporter;

  last(): CapturedMail {
    const mail = this.sent.at(-1);
    if (!mail) throw new Error('No mail was sent');
    return mail;
  }

  /** The token from the last mail's link, as a recipient clicking it sends. */
  lastToken(): string {
    const match =
      /https?:\/\/\S+?\/(?:verify-email\/|reset-password\?token=)([\w-]+)/.exec(
        this.last().text
      );
    if (!match) {
      throw new Error(`No token link in mail: ${this.last().text}`);
    }
    return match[1];
  }

  clear(): void {
    this.sent.length = 0;
  }
}
