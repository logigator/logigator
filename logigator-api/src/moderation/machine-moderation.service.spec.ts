import { Logger } from '@nestjs/common';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Env } from '../config/env';
import type { Database } from '../database/database.module';
import type { MailService } from '../mail/mail.service';
import { Metrics } from '../metrics/metrics';
import {
  MachineModerationService,
  type MachineVerdictInput
} from './machine-moderation.service';
import type { ModerationService } from './moderation.service';
import type { ModerationVerdict } from './moderation-verdict';

const DOCUMENT = {
  id: 'doc-1',
  link: 'abcdef',
  name: 'Adder',
  userId: 'owner-1',
  textLanguageHint: null
};

/**
 * A database on which every guarded write lands: the hide's update and
 * insert, and the report's insert-and-read.
 */
const landing = {
  transaction: async (write: (tx: unknown) => Promise<unknown>) =>
    write({
      update: () => ({
        set: () => ({ where: () => ({ returning: async () => [DOCUMENT] }) })
      }),
      insert: () => ({
        values: () => ({ returning: async () => [{ id: 'report-1' }] })
      })
    }),
  execute: async () => ({
    rows: [
      {
        id: 'report-2',
        link: DOCUMENT.link,
        name: DOCUMENT.name,
        user_id: DOCUMENT.userId,
        text_language_hint: null
      }
    ]
  })
} as unknown as Database;

function service(autoHide: boolean, db: Database = landing) {
  const metrics = new Metrics();
  const machine = new MachineModerationService(
    db,
    {
      MODERATION_AUTO_HIDE: autoHide,
      PUBLIC_URL: 'https://logigator.test'
    } as Env,
    { sendDocumentReport: async () => undefined } as unknown as MailService,
    { mailOwnerHidden: async () => true } as unknown as ModerationService,
    metrics
  );
  return { machine, metrics };
}

function input(verdict: Omit<ModerationVerdict, 'note'>): MachineVerdictInput {
  return {
    kind: 'project',
    documentId: DOCUMENT.id,
    textDigest: 'digest',
    verdict: { ...verdict, note: '' },
    call: null
  };
}

async function series(metric: {
  get(): Promise<{ values: { labels: object; value: number }[] }>;
}) {
  return (await metric.get()).values.map(({ labels, value }) => ({
    ...labels,
    value
  }));
}

describe('MachineModerationService metrics', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  it('counts every verdict by category and certainty, a clean one included', async () => {
    // A clean verdict touches nothing.
    const { machine, metrics } = service(false, {} as Database);

    await machine.apply(input({ category: 'none', certain: false }));
    await machine.apply(input({ category: 'none', certain: false }));

    expect(await series(metrics.moderationVerdicts)).toEqual([
      { category: 'none', certain: 'false', value: 2 }
    ]);
  });

  it('counts a hide only when a certain severe verdict hid the document', async () => {
    const { machine, metrics } = service(true);

    expect(
      await machine.apply(input({ category: 'harassment', certain: true }))
    ).toBe('hidden');
    expect(
      await machine.apply(input({ category: 'harassment', certain: false }))
    ).toBe('reported');
    expect(
      await machine.apply(input({ category: 'spam', certain: true }))
    ).toBe('reported');

    expect(await series(metrics.moderationAutoHides)).toEqual([{ value: 1 }]);
    expect(await series(metrics.moderationVerdicts)).toEqual([
      { category: 'harassment', certain: 'true', value: 1 },
      { category: 'harassment', certain: 'false', value: 1 },
      { category: 'spam', certain: 'true', value: 1 }
    ]);
  });

  it('counts no hide while auto-hide is off', async () => {
    const { machine, metrics } = service(false);

    expect(
      await machine.apply(input({ category: 'illegal', certain: true }))
    ).toBe('reported');
    expect(await series(metrics.moderationAutoHides)).toEqual([{ value: 0 }]);
  });
});
