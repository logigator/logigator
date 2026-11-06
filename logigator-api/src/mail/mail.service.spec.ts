import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import type { Transporter } from 'nodemailer';
import { loadEnv } from '../config/env';
import { Metrics } from '../metrics/metrics';
import { MailService } from './mail.service';

const RECIPIENT = {
  email: 'ada@example.com',
  username: 'Ada',
  locale: 'en' as const
};

function service(options: { smtp: boolean; failing?: boolean }) {
  const env = loadEnv({
    ...(options.smtp ? { SMTP_URL: 'smtp://mail.example' } : {}),
    REPORT_MAIL_TO: 'operator@example.com'
  });
  const transport = {
    sendMail: () =>
      options.failing
        ? Promise.reject(new Error('SMTP unavailable'))
        : Promise.resolve({})
  } as unknown as Transporter;
  const metrics = new Metrics();
  return { mail: new MailService(transport, env, metrics), metrics };
}

async function counted(metrics: Metrics) {
  const mails = (await metrics.mails.get()).values.map(({ labels, value }) => ({
    ...labels,
    value
  }));
  const outbound = (await metrics.outboundRequests.get()).values.map(
    ({ labels, value }) => ({ ...labels, value })
  );
  return { mails, outbound };
}

describe('MailService', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockReturnValue(undefined);
    vi.spyOn(Logger.prototype, 'debug').mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('counts a mail with no SMTP_URL as skipped, and no outbound call', async () => {
    const { mail, metrics } = service({ smtp: false });

    await mail.sendPasswordReset(RECIPIENT, 'token');
    await mail.sendErrorReport({ subject: 'Error report', body: '' });

    expect(await counted(metrics)).toEqual({
      mails: [
        { kind: 'resetPassword', outcome: 'skipped', value: 1 },
        { kind: 'operator', outcome: 'skipped', value: 1 }
      ],
      outbound: []
    });
  });

  it('counts a mail the transport threw on as failed, and passes the error on', async () => {
    const { mail, metrics } = service({ smtp: true, failing: true });

    await expect(
      mail.sendRegistrationVerification(RECIPIENT, 'token')
    ).rejects.toThrow('SMTP unavailable');

    expect(await counted(metrics)).toEqual({
      mails: [{ kind: 'verifyRegistration', outcome: 'failed', value: 1 }],
      outbound: [{ target: 'smtp', outcome: 'error', value: 1 }]
    });
  });

  it('counts a delivered mail as sent', async () => {
    const { mail, metrics } = service({ smtp: true });

    await mail.sendDocumentReport({ subject: 'Document report', body: '' });

    expect(await counted(metrics)).toEqual({
      mails: [{ kind: 'operator', outcome: 'sent', value: 1 }],
      outbound: [{ target: 'smtp', outcome: 'ok', value: 1 }]
    });
  });
});
