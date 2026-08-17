import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../config/env';

/** DI token for the nodemailer transport. */
export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');

/**
 * The transport, from a single connection URL
 * (`smtps://user:pass@host:465`) — nodemailer parses it, so credentials never
 * need four separate variables.
 *
 * With no `SMTP_URL` configured the transport renders the message and hands it
 * back instead of sending it (`jsonTransport`), which {@link MailService} logs.
 * A development machine has no mail server, and the alternative — a hard failure
 * on registration — would make the whole sign-up flow unreachable locally. The
 * message still goes through nodemailer, so what is logged is what would have
 * been sent.
 *
 * The timeouts matter: an unreachable SMTP host must fail a request in seconds
 * rather than hold a connection open until the client gives up.
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
