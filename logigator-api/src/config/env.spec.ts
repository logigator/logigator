import { describe, expect, it } from 'vitest';
import { DEVELOPMENT_SESSION_SECRET, loadEnv } from './env';

/**
 * What a production deployment has to say for itself before the schema lets it
 * boot: a private secret, and a declared proxy.
 */
const PRODUCTION = {
  NODE_ENV: 'production',
  SESSION_SECRET: 'x'.repeat(32),
  TRUST_PROXY: 'uniquelocal'
};

describe('loadEnv', () => {
  it('falls back to defaults for an empty environment', () => {
    // A bare `docker compose up` must boot with no configuration anywhere.
    expect(loadEnv({})).toEqual({
      NODE_ENV: 'development',
      HOST: '0.0.0.0',
      PORT: 3000,
      LOG_LEVEL: 'info',
      DATABASE_URL: 'postgresql://logigator:logigator@postgres:5432/logigator',
      DATABASE_POOL_MAX: 10,
      DATABASE_MIGRATION_CHECK: true,
      REDIS_URL: 'redis://redis:6379',
      REDIS_KEY_PREFIX: 'lg:',
      PUBLIC_URL: 'http://logigator.test',
      MAIL_FROM: 'Logigator <noreply@logigator.com>',
      GOOGLE_CALLBACK_URL: 'http://logigator.test/api/auth/google/callback',
      OAUTH_RETURN_URL: 'http://logigator.test/login',
      STORAGE_DIR: 'data/storage',
      STORAGE_SWEEP_GRACE_MINUTES: 1440,
      UPLOAD_MAX_BYTES: 5 * 1024 * 1024,
      SESSION_SECRET: DEVELOPMENT_SESSION_SECRET,
      SESSION_COOKIE_NAME: 'lg_sid',
      SESSION_MAX_AGE_DAYS: 30,
      COOKIE_SECURE: false,
      TRUST_PROXY: false,
      AUTH_TOKEN_TTL_MINUTES: 60,
      BCRYPT_COST: 12
    });
  });

  it('treats a blank value as unset', () => {
    expect(loadEnv({ PORT: '', LOG_LEVEL: '  ' })).toMatchObject({
      PORT: 3000,
      LOG_LEVEL: 'info'
    });
  });

  it('parses the port as a number', () => {
    expect(loadEnv({ PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects a port outside the valid range', () => {
    expect(() => loadEnv({ PORT: '70000' })).toThrowError(/PORT/);
  });

  it('rejects an unknown NODE_ENV instead of passing it through', () => {
    expect(() => loadEnv({ NODE_ENV: 'staging' })).toThrowError(/NODE_ENV/);
  });

  it('refuses to run in production on the public development secret', () => {
    // It is in the repository, so anyone could forge a session cookie.
    expect(() =>
      loadEnv({ ...PRODUCTION, SESSION_SECRET: undefined })
    ).toThrowError(/SESSION_SECRET/);
    expect(loadEnv(PRODUCTION).SESSION_SECRET).toBe('x'.repeat(32));
  });

  it('rejects half-configured Google credentials', () => {
    // Half-configured looks enabled and fails at the token exchange, after the
    // user has already been to Google and back.
    expect(() => loadEnv({ GOOGLE_CLIENT_ID: 'id' })).toThrowError(/GOOGLE/);
    expect(() => loadEnv({ GOOGLE_CLIENT_SECRET: 'secret' })).toThrowError(
      /GOOGLE/
    );
    expect(() =>
      loadEnv({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' })
    ).not.toThrow();
  });

  it('derives the OAuth URLs from the public URL', () => {
    const env = loadEnv({ PUBLIC_URL: 'https://logigator.com' });

    expect(env.GOOGLE_CALLBACK_URL).toBe(
      'https://logigator.com/api/auth/google/callback'
    );
    expect(env.OAUTH_RETURN_URL).toBe('https://logigator.com/login');
  });

  it('rejects a session secret too short to sign a cookie with', () => {
    expect(() => loadEnv({ SESSION_SECRET: 'short' })).toThrowError(
      /SESSION_SECRET/
    );
  });

  it('makes cookies secure in production and leaves them overridable', () => {
    expect(loadEnv(PRODUCTION).COOKIE_SECURE).toBe(true);
    expect(loadEnv({}).COOKIE_SECURE).toBe(false);
    // A deployment terminating TLS somewhere unusual has to be able to say so.
    expect(
      loadEnv({ COOKIE_SECURE: 'true', TRUST_PROXY: 'loopback' }).COOKIE_SECURE
    ).toBe(true);
    expect(
      loadEnv({ ...PRODUCTION, COOKIE_SECURE: 'false' }).COOKIE_SECURE
    ).toBe(false);
  });

  it('refuses secure cookies without a trusted proxy', () => {
    // Silently broken: `@fastify/session` writes no `Secure` cookie over a
    // connection it thinks is plain, and it thinks that for as long as
    // `X-Forwarded-Proto` is untrusted. Logins would 200 and start no session.
    expect(() => loadEnv({ ...PRODUCTION, TRUST_PROXY: 'false' })).toThrowError(
      /TRUST_PROXY/
    );
    expect(() => loadEnv({ COOKIE_SECURE: 'true' })).toThrowError(
      /TRUST_PROXY/
    );

    // A directly reachable server must not let a caller pick its own address.
    expect(loadEnv({}).TRUST_PROXY).toBe(false);
    expect(
      loadEnv({ ...PRODUCTION, COOKIE_SECURE: 'false', TRUST_PROXY: 'false' })
        .TRUST_PROXY
    ).toBe(false);
  });

  it('refuses a hop count left over from the old contract', () => {
    // The one malformed value Fastify would not catch: its matcher reads `1` as
    // the address `0.0.0.1`, so the process would boot trusting nothing real.
    expect(() => loadEnv({ TRUST_PROXY: '1' })).toThrowError(/TRUST_PROXY/);
    expect(() => loadEnv({ ...PRODUCTION, TRUST_PROXY: '0' })).toThrowError(
      /TRUST_PROXY/
    );
  });

  it('hands an addressed proxy to Fastify as written', () => {
    // Only the two literals mean anything here; a preset or an address list is
    // Fastify's vocabulary and has to reach its matcher unparsed.
    expect(loadEnv({ TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(true);
    expect(loadEnv({ TRUST_PROXY: 'uniquelocal' }).TRUST_PROXY).toBe(
      'uniquelocal'
    );
    expect(
      loadEnv({ TRUST_PROXY: '127.0.0.1, 172.16.0.0/12' }).TRUST_PROXY
    ).toBe('127.0.0.1, 172.16.0.0/12');
  });

  it('reports every problem at once', () => {
    let message = '';
    try {
      loadEnv({ PORT: 'http', LOG_LEVEL: 'chatty' });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toMatch(/PORT/);
    expect(message).toMatch(/LOG_LEVEL/);
  });
});
