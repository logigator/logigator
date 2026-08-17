import { describe, expect, it } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { localeFromRequest, resolveLocale } from './locale';

function request(
  cookies: Record<string, string | undefined>,
  acceptLanguage?: string
): FastifyRequest {
  return {
    cookies,
    headers: acceptLanguage ? { 'accept-language': acceptLanguage } : {}
  } as unknown as FastifyRequest;
}

/** How the landing pages write the shared `preferences` cookie. */
function preferencesCookie(value: unknown): string {
  return encodeURIComponent(`j:${JSON.stringify(value)}`);
}

describe('resolveLocale', () => {
  it('falls back to English for anything unsupported', () => {
    expect(resolveLocale('de')).toBe('de');
    expect(resolveLocale('it')).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });
});

describe('localeFromRequest', () => {
  it('prefers the chosen language over the browser header', () => {
    const chosen = request(
      { preferences: preferencesCookie({ lang: 'fr', theme: 'dark' }) },
      'de-DE,de;q=0.9'
    );

    expect(localeFromRequest(chosen)).toBe('fr');
  });

  it('falls back to the header when the cookie names no language', () => {
    const themeOnly = request(
      { preferences: preferencesCookie({ theme: 'light' }) },
      'es-ES,es;q=0.9,en;q=0.8'
    );

    expect(localeFromRequest(themeOnly)).toBe('es');
  });

  it('absorbs a malformed cookie rather than failing the request', () => {
    // The cookie is client-writable, so garbage in it is a state to survive.
    const broken = request({ preferences: 'j:{not json' }, 'de;q=0.9');

    expect(localeFromRequest(broken)).toBe('de');
  });

  it('skips languages the site does not speak', () => {
    expect(localeFromRequest(request({}, 'it-IT,it;q=0.9,fr;q=0.8'))).toBe(
      'fr'
    );
    expect(localeFromRequest(request({}, 'it-IT'))).toBe('en');
    expect(localeFromRequest(request({}))).toBe('en');
  });
});
