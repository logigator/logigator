import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { ENV, loadEnv } from '../config/env';
import { PasswordService } from './password.service';

/**
 * A hash the stack being replaced produced: `bcrypt` at its 9 salt rounds, for
 * the password below. The whole migration rests on hashes like this one still
 * verifying, so it is pinned here rather than generated — a hash made by the
 * library under test could not detect a change in what it accepts.
 */
const LEGACY_HASH =
  '$2b$09$18bH31m/iSlckJkNuwtz2.Lsp.hLj2qqcwFcgHaTzWmJS5zMLTWTe';
const LEGACY_PASSWORD = 'correct horse battery staple';

async function passwordService(cost?: string): Promise<PasswordService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      PasswordService,
      {
        provide: ENV,
        useValue: loadEnv(cost ? { BCRYPT_COST: cost } : {})
      }
    ]
  }).compile();

  return moduleRef.get(PasswordService);
}

describe('PasswordService', () => {
  it('verifies a password against a hash the legacy backend wrote', async () => {
    const passwords = await passwordService();

    expect(await passwords.verify(LEGACY_PASSWORD, LEGACY_HASH)).toBe(true);
    expect(await passwords.verify('something else', LEGACY_HASH)).toBe(false);
  });

  it('marks a hash weaker than the configured cost for rehashing', async () => {
    const passwords = await passwordService();

    // Cost 9 is what the legacy stack used; the default is higher now, so those
    // hashes are upgraded the next time their owner signs in.
    expect(passwords.needsRehash(LEGACY_HASH)).toBe(true);
    expect(passwords.needsRehash(await passwords.hash('freshly1'))).toBe(false);
  });

  it('leaves a hash alone when the cost was lowered', async () => {
    // Not a rehash-on-every-login loop: only an increase in cost is a reason to
    // rewrite a hash, and the E2E harness deliberately runs at cost 4.
    const passwords = await passwordService('4');

    expect(passwords.needsRehash(LEGACY_HASH)).toBe(false);
  });

  it('answers a nonexistent account without giving it away', async () => {
    const passwords = await passwordService('4');

    expect(await passwords.verifyNothing('any password')).toBe(false);
  });
});
