import type { Transporter } from 'nodemailer';

export interface CapturedMail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Stands in for the nodemailer transport so specs can read what was sent.
 *
 * The alternative — letting the real transport render into its log and digging
 * the token out of Redis — would test the flow without ever asserting that a mail
 * went to the right address, which is half of what these flows promise. The token
 * is recovered from the link, exactly as a recipient would.
 */
export class MailCapture {
  readonly sent: CapturedMail[] = [];

  /**
   * Set to make the next send reject, for the flows that have to keep their
   * promise when the mail server is down — a password reset must answer a known
   * and an unknown address identically either way.
   */
  failNextSend = false;

  /** Only `sendMail` is ever called on a transport by {@link MailService}. */
  readonly transport = {
    sendMail: (message: {
      to?: unknown;
      subject?: unknown;
      html?: unknown;
      text?: unknown;
    }) => {
      if (this.failNextSend) {
        this.failNextSend = false;
        return Promise.reject(new Error('SMTP unavailable'));
      }

      this.sent.push({
        to: String(message.to ?? ''),
        subject: String(message.subject ?? ''),
        html: String(message.html ?? ''),
        text: String(message.text ?? '')
      });
      return Promise.resolve({ accepted: [message.to] });
    }
  } as unknown as Transporter;

  /** The most recent mail, or a failure that names what did arrive. */
  last(): CapturedMail {
    const mail = this.sent.at(-1);
    if (!mail) throw new Error('No mail was sent');
    return mail;
  }

  /** The token from the last mail's link — what a recipient clicking it would send. */
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
