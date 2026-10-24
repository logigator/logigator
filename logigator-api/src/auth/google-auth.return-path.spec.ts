import { beforeEach, describe, expect, it, vi } from 'vitest';

// The protocol library is replaced wholesale: this spec is about what the flow
// record keeps, and discovery would go to Google to find out nothing relevant.
vi.mock('openid-client', () => ({
  discovery: () => Promise.resolve({}),
  buildAuthorizationUrl: () => new URL('https://accounts.google.com/o/oauth2'),
  calculatePKCECodeChallenge: () => Promise.resolve('challenge'),
  randomPKCECodeVerifier: () => 'verifier',
  randomState: () => 'state',
  randomNonce: () => 'nonce',
  authorizationCodeGrant: () =>
    Promise.resolve({
      claims: () => ({ sub: 'google-user', email: 'ada@example.com' })
    })
}));

const { GoogleAuthService } = await import('./google-auth.service');
type Env = ConstructorParameters<typeof GoogleAuthService>[0];

const USER = { id: 'user-id' };

class FakeRedis {
  public readonly records = new Map<string, unknown>();

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

describe('Google sign-in return path', () => {
  let redis: FakeRedis;
  let google: InstanceType<typeof GoogleAuthService>;

  /** The single record the flow leaves behind, whatever key it chose. */
  function storedFlow(): { returnPath?: string } {
    return [...redis.records.values()][0] as { returnPath?: string };
  }

  beforeEach(() => {
    redis = new FakeRedis();
    google = new GoogleAuthService(
      {
        GOOGLE_CLIENT_ID: 'id',
        GOOGLE_CLIENT_SECRET: 'secret',
        GOOGLE_CALLBACK_URL: 'https://logigator.test/api/auth/google/callback'
      } as Env,
      redis as never,
      { findByGoogleUserId: () => Promise.resolve(USER) } as never,
      {} as never,
      {} as never
    );
  });

  it('keeps a destination on this origin so the callback can reach it', async () => {
    await google.createAuthorizationUrl(undefined, '/de/community/projects');
    expect(storedFlow().returnPath).toBe('/de/community/projects');

    const result = await google.completeCallback({ state: 'state' });
    expect(result.returnPath).toBe('/de/community/projects');
  });

  it('drops a destination that would leave the origin', async () => {
    // The route is unauthenticated, so a target it accepted from the caller
    // would make an open redirect out of a real Logigator link.
    await google.createAuthorizationUrl(undefined, '//evil.test/phish');
    expect(storedFlow()).not.toHaveProperty('returnPath');

    const result = await google.completeCallback({ state: 'state' });
    expect(result.returnPath).toBeUndefined();
  });
});
