import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The identity Google answers the next exchange with. */
let googleSub = 'google-ada';

vi.mock('openid-client', () => ({
  discovery: () => Promise.resolve({}),
  buildAuthorizationUrl: () => new URL('https://accounts.google.com/o/oauth2'),
  calculatePKCECodeChallenge: () => Promise.resolve('challenge'),
  randomPKCECodeVerifier: () => 'verifier',
  randomState: () => 'state',
  randomNonce: () => 'nonce',
  authorizationCodeGrant: () =>
    Promise.resolve({
      claims: () => ({ sub: googleSub, email: 'someone@example.com' })
    })
}));

const { GoogleAuthService } = await import('./google-auth.service');
type Env = ConstructorParameters<typeof GoogleAuthService>[0];

interface Account {
  id: string;
  googleUserId: string | null;
}

class FakeRedis {
  private readonly records = new Map<string, unknown>();

  setJson(key: string, value: unknown): Promise<void> {
    this.records.set(key, value);
    return Promise.resolve();
  }

  takeJson<T>(key: string): Promise<T | null> {
    const value = this.records.get(key) as T | undefined;
    this.records.delete(key);
    return Promise.resolve(value ?? null);
  }
}

class FakeUsers {
  constructor(readonly accounts: Account[]) {}

  findById(id: string): Promise<Account | null> {
    return Promise.resolve(this.accounts.find((a) => a.id === id) ?? null);
  }

  findByGoogleUserId(sub: string): Promise<Account | null> {
    return Promise.resolve(
      this.accounts.find((a) => a.googleUserId === sub) ?? null
    );
  }

  update(id: string, changes: Partial<Account>): Promise<Account | null> {
    const account = this.accounts.find((a) => a.id === id);
    if (account) Object.assign(account, changes);
    return Promise.resolve(account ?? null);
  }
}

/**
 * A round trip started from a session is how a member without a password
 * re-authenticates, so it answers an account to sign in again exactly when
 * Google vouched for the identity that account already has — and never swaps
 * that identity for another one.
 */
describe('a Google round trip from a session', () => {
  let users: FakeUsers;
  let google: InstanceType<typeof GoogleAuthService>;

  async function roundTrip(signedInAs: string) {
    await google.createAuthorizationUrl(signedInAs, '/en/my/account');
    return google.completeCallback({ state: 'state' }, signedInAs);
  }

  beforeEach(() => {
    users = new FakeUsers([
      { id: 'ada', googleUserId: 'google-ada' },
      { id: 'grace', googleUserId: null },
      { id: 'alan', googleUserId: 'google-alan' }
    ]);
    google = new GoogleAuthService(
      {
        GOOGLE_CLIENT_ID: 'id',
        GOOGLE_CLIENT_SECRET: 'secret',
        GOOGLE_CALLBACK_URL: 'https://logigator.test/api/auth/google/callback'
      } as Env,
      new FakeRedis() as never,
      users as never,
      {} as never,
      {} as never
    );
  });

  it('signs the account in again with its own identity', async () => {
    googleSub = 'google-ada';

    const result = await roundTrip('ada');

    expect(result.user?.id).toBe('ada');
  });

  it('refuses another identity where the account already has one', async () => {
    googleSub = 'google-stranger';

    await expect(roundTrip('ada')).rejects.toMatchObject({
      failure: 'google_account_mismatch',
      returnPath: '/en/my/account'
    });
    expect(users.accounts[0]?.googleUserId).toBe('google-ada');
  });

  it('refuses the identity of another account without signing anyone in', async () => {
    googleSub = 'google-alan';

    await expect(roundTrip('ada')).rejects.toMatchObject({
      failure: 'google_already_linked'
    });
  });

  it('links a first identity without counting it as a sign-in', async () => {
    googleSub = 'google-grace';

    const result = await roundTrip('grace');

    expect(result.user).toBeNull();
    expect(users.accounts[1]?.googleUserId).toBe('google-grace');
  });
});
