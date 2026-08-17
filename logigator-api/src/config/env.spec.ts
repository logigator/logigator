import { describe, expect, it } from 'vitest';
import { DEVELOPMENT_SESSION_SECRET, loadEnv } from './env';

describe('loadEnv', () => {
  it('falls back to defaults for an empty environment', () => {
    // Every variable is defaulted on purpose: a bare `docker compose up` must
    // bring the API up with no configuration file anywhere.
    expect(loadEnv({})).toEqual({
      NODE_ENV: 'development',
      HOST: '0.0.0.0',
      PORT: 3000,
      LOG_LEVEL: 'info',
      DATABASE_URL: 'postgresql://logigator:logigator@postgres:5432/logigator',
      DATABASE_POOL_MAX: 10,
      REDIS_URL: 'redis://redis:6379',
      REDIS_KEY_PREFIX: 'lg:',
      PUBLIC_URL: 'http://logigator.test',
      MAIL_FROM: 'Logigator <noreply@logigator.com>',
      SESSION_SECRET: DEVELOPMENT_SESSION_SECRET,
      SESSION_COOKIE_NAME: 'lg_sid',
      SESSION_MAX_AGE_DAYS: 30,
      COOKIE_SECURE: false,
      TRUST_PROXY: 0,
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
    // Anyone holding it could forge a session cookie, and it is in the
    // repository — so this is the one default production may not inherit.
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrowError(
      /SESSION_SECRET/
    );
    expect(
      loadEnv({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32) })
        .SESSION_SECRET
    ).toBe('x'.repeat(32));
  });

  it('rejects a session secret too short to sign a cookie with', () => {
    expect(() => loadEnv({ SESSION_SECRET: 'short' })).toThrowError(
      /SESSION_SECRET/
    );
  });

  it('makes cookies secure in production and leaves them overridable', () => {
    expect(
      loadEnv({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32) })
        .COOKIE_SECURE
    ).toBe(true);
    expect(loadEnv({}).COOKIE_SECURE).toBe(false);
    // A deployment terminating TLS somewhere unusual has to be able to say so.
    expect(loadEnv({ COOKIE_SECURE: 'true' }).COOKIE_SECURE).toBe(true);
    expect(
      loadEnv({
        NODE_ENV: 'production',
        SESSION_SECRET: 'x'.repeat(32),
        COOKIE_SECURE: 'false'
      }).COOKIE_SECURE
    ).toBe(false);
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
