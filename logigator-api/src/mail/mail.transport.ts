import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../config/env';

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');

/**
 * The transport, from a single connection URL nodemailer parses, so credentials
 * never need four separate variables.
 *
 * With no `SMTP_URL` the message still goes through nodemailer but comes back
 * instead of being sent (`jsonTransport`), and {@link MailService} logs it — so
 * a development machine with no mail server can still reach the next step of a
 * sign-up. The timeouts keep an unreachable SMTP host from holding a request
 * open until the client gives up.
 */
export function createMailTransport(env: Env): Transporter {
  if (!env.SMTP_URL) {
    return createTransport({ jsonTransport: true });
  }

  return createTransport(env.SMTP_URL, {
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000
  });
}
