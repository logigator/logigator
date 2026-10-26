import { describe, expect, it } from 'vitest';
import type { RedisService } from '../redis/redis.service';
import {
  failureBudgets,
  LoginAttemptsService,
  type PasswordAccount
} from './login-attempts.service';

/** The two counter commands the budgets use, over a map; windows never end. */
function fakeRedis(): RedisService {
  const counts = new Map<string, number>();
  const step = (keys: string[], by: number) =>
    keys.map((key) => {
      const count = (counts.get(key) ?? 0) + by;
      counts.set(key, count);
      return count;
    });
  return {
    countInWindows: async (keys: string[]) => step(keys, 1),
    uncountInWindows: async (keys: string[]) => {
      step(keys, -1);
    }
  } as unknown as RedisService;
}

const ADA = 'ada@example.com';
const ADA_SESSION: PasswordAccount = {
  email: ADA,
  signedInAs: '0d5c1f6e-7a2b-4c39-9e51-3f8a6b2d4c10'
};

/** Wrong passwords: admitted and never forgiven. */
async function fail(
  attempts: LoginAttemptsService,
  times: number,
  ip: string,
  account: PasswordAccount
): Promise<void> {
  for (let attempt = 0; attempt < times; attempt += 1) {
    await attempts.admit(ip, account);
  }
}

describe('failureBudgets', () => {
  it('keys one mailbox once, however its address is spelled', () => {
    expect(failureBudgets('192.0.2.1', { email: ' Ada@Example.COM ' })).toEqual(
      failureBudgets('192.0.2.1', { email: ADA })
    );
  });

  it('keeps the address out of every key', () => {
    for (const { key } of failureBudgets('192.0.2.1', ADA_SESSION)) {
      expect(key).not.toContain('ada');
      expect(key).not.toContain('example');
    }
  });
});

describe('LoginAttemptsService', () => {
  it('adds a session’s wrong passwords to the sign-in’s for that account and address', async () => {
    const attempts = new LoginAttemptsService(fakeRedis());
    await fail(attempts, 5, '192.0.2.1', ADA_SESSION);
    await fail(attempts, 5, '192.0.2.1', { email: ADA });

    await expect(attempts.admit('192.0.2.1', { email: ADA })).rejects.toThrow(
      'Too many attempts'
    );
    await expect(
      attempts.admit('192.0.2.1', { email: 'grace@example.com' })
    ).resolves.toBeUndefined();
  });

  it('budgets a session’s wrong passwords across addresses, but not a sign-in’s', async () => {
    const attempts = new LoginAttemptsService(fakeRedis());
    for (let address = 1; address <= 10; address += 1) {
      await fail(attempts, 1, `192.0.2.${address}`, ADA_SESSION);
    }

    await expect(attempts.admit('198.51.100.1', ADA_SESSION)).rejects.toThrow(
      'Too many attempts'
    );
    await expect(
      attempts.admit('198.51.100.1', { email: ADA })
    ).resolves.toBeUndefined();
    await expect(
      attempts.admit('198.51.100.1', {
        email: 'grace@example.com',
        signedInAs: 'grace-id'
      })
    ).resolves.toBeUndefined();
  });

  it('counts neither a forgiven attempt nor a refused one', async () => {
    const attempts = new LoginAttemptsService(fakeRedis());
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await attempts.admit('192.0.2.1', ADA_SESSION);
      await attempts.forgive('192.0.2.1', ADA_SESSION);
    }
    await fail(attempts, 10, '192.0.2.1', ADA_SESSION);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(attempts.admit('192.0.2.1', ADA_SESSION)).rejects.toThrow();
    }

    // The address budget holds exactly the ten failures: ninety more fit.
    for (let account = 0; account < 90; account += 1) {
      await attempts.admit('192.0.2.1', {
        email: `nobody${account}@example.com`
      });
    }
    await expect(
      attempts.admit('192.0.2.1', { email: 'somebody@example.com' })
    ).rejects.toThrow();
  });
});
