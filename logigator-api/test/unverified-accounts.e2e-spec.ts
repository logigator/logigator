import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { users } from '../src/database/schema';
import {
  UNVERIFIED_ACCOUNT_RETENTION_DAYS,
  UnverifiedAccountSweepService
} from '../src/users/unverified-account-sweep.service';
import { startE2eApp, type E2eApp } from './harness';

const DAY = 24 * 60 * 60 * 1000;

describe('the unverified-account sweep', () => {
  let api: E2eApp;

  async function register(email: string): Promise<string> {
    await api.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: email.split('@')[0], email, password: 'lovelace1' }
    });
    const [row] = await api.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));
    return row.id;
  }

  async function registeredDaysAgo(id: string, days: number): Promise<void> {
    await api.db
      .update(users)
      .set({ memberSince: new Date(Date.now() - days * DAY) })
      .where(eq(users.id, id));
  }

  beforeAll(async () => {
    api = await startE2eApp();
  });

  afterAll(async () => {
    await api.close();
  });

  it('deletes only accounts left unconfirmed past the retention window', async () => {
    const stale = await register('stale@example.com');
    const fresh = await register('fresh@example.com');
    const confirmed = await register('confirmed@example.com');
    await api.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      payload: { token: api.mail.lastToken() }
    });

    await registeredDaysAgo(stale, UNVERIFIED_ACCOUNT_RETENTION_DAYS + 1);
    await registeredDaysAgo(fresh, UNVERIFIED_ACCOUNT_RETENTION_DAYS - 1);
    // A confirmed account is kept however old it is.
    await registeredDaysAgo(confirmed, UNVERIFIED_ACCOUNT_RETENTION_DAYS * 10);

    const removed = await api.app.get(UnverifiedAccountSweepService).sweep();

    const left = await api.db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, [stale, fresh, confirmed]));
    expect(removed).toBe(1);
    expect(left.map(({ id }) => id).sort()).toEqual([fresh, confirmed].sort());
  });
});
