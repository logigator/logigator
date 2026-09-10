import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { IncomingMessage } from 'node:http';
import { requestOrigin } from './request-origin';

/** The parts of a node request the derivation reads. */
function request(headers: Record<string, string>): IncomingMessage {
  return {
    method: 'GET',
    url: '/en/changelog.atom',
    headers,
    socket: {}
  } as unknown as IncomingMessage;
}

const VARIABLES = ['NG_ALLOWED_HOSTS', 'NG_TRUST_PROXY_HEADERS'];

describe('requestOrigin', () => {
  // The two variables are how a deployment configures this, so a run that has
  // them set is a run where every case here means something else.
  let restore: (string | undefined)[] = [];

  beforeEach(() => {
    restore = VARIABLES.map((name) => process.env[name]);
    for (const name of VARIABLES) {
      delete process.env[name];
    }
  });

  afterEach(() => {
    VARIABLES.forEach((name, index) => {
      const value = restore[index];
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    });
  });

  it('refuses a host the deployment does not answer for', () => {
    process.env['NG_ALLOWED_HOSTS'] = 'logigator.com';

    expect(requestOrigin(request({ host: 'logigator.com' }))).toBe(
      'http://logigator.com'
    );
    expect(requestOrigin(request({ host: 'evil.example' }))).toBeNull();
  });

  it('reads a forwarded host and scheme only where they are trusted', () => {
    process.env['NG_ALLOWED_HOSTS'] = 'logigator.com';
    const forwarded = request({
      host: 'web:4000',
      'x-forwarded-host': 'logigator.com',
      'x-forwarded-proto': 'https'
    });

    expect(requestOrigin(forwarded)).toBeNull();

    process.env['NG_TRUST_PROXY_HEADERS'] =
      'x-forwarded-host,x-forwarded-proto';

    expect(requestOrigin(forwarded)).toBe('https://logigator.com');
  });

  it('answers only for itself when no list is configured', () => {
    // Angular's own list is empty until the variable sets it, so refusing is
    // what agrees with the renders beside this response.
    expect(requestOrigin(request({ host: 'localhost:4200' }))).toBe(
      'http://localhost:4200'
    );
    expect(requestOrigin(request({ host: 'logigator.com' }))).toBeNull();
  });

  it('refuses a host that is not a host, rather than throwing at the middleware', () => {
    expect(requestOrigin(request({ host: 'a b' }))).toBeNull();
    expect(requestOrigin(request({ host: '[::1' }))).toBeNull();
  });
});
