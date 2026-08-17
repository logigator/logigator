import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startE2eApp, type E2eApp } from './harness';

/**
 * The parts of the OAuth round trip that never talk to Google: the refusal when
 * no credentials are configured, and the failure redirect a callback takes when it
 * cannot name a flow this server started. Between them they cover the routes'
 * own behaviour — everything past the state lookup is `openid-client`'s protocol
 * work against a live provider, which belongs in a manual pass, not in CI.
 */
describe('Google sign-in when it is not configured', () => {
  let api: E2eApp;

  beforeAll(async () => {
    api = await startE2eApp();
  });

  afterAll(async () => {
    await api.close();
  });

  it('says so rather than pretending, and says so in the contract shape', async () => {
    const response = await api.inject({
      method: 'GET',
      url: '/api/auth/google'
    });

    expect(response.statusCode).toBe(501);
    expect(response.json()).toMatchObject({ code: 'internal' });
  });

  it('is absent from the providers clients draw their login form from', async () => {
    const meta = await api.inject({ method: 'GET', url: '/api/meta' });

    expect(meta.json().authProviders).toEqual(['local']);
  });
});

describe('Google sign-in callbacks', () => {
  let api: E2eApp;

  beforeAll(async () => {
    // Credentials only have to exist for the routes to be enabled; nothing here
    // reaches the point of using them.
    api = await startE2eApp({
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      OAUTH_RETURN_URL: 'http://logigator.test/login'
    });
  });

  afterAll(async () => {
    await api.close();
  });

  it('sends an unknown state back to the login page with a reason', async () => {
    const response = await api.inject({
      method: 'GET',
      url: '/api/auth/google/callback?code=whatever&state=never-issued'
    });

    // A callback that cannot name a flow this server started gets no further —
    // the state lookup fails before any token exchange is attempted.
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(
      'http://logigator.test/login?error=google_state_invalid'
    );
  });

  it('offers Google to clients once it is configured', async () => {
    const meta = await api.inject({ method: 'GET', url: '/api/meta' });

    expect(meta.json().authProviders).toEqual(['local', 'google']);
  });
});
