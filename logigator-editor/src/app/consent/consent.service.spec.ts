import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CONSENT_COOKIE, encodeConsent } from '@logigator/core';
import { configureTestBed } from '../../testing/configure-test-bed';
import { CookieService } from '../storage/cookie.service';
import { ConsentService } from './consent.service';

function clearCookies(): void {
  document.cookie = `${CONSENT_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

describe('ConsentService', () => {
  beforeEach(() => {
    clearCookies();
    configureTestBed();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    clearCookies();
  });

  it('closes the question once the website records an answer', () => {
    // The cookie is origin-wide: an answer given in a site tab reaches the
    // editor through the cookie map, not through anything the editor did.
    const consent = TestBed.inject(ConsentService);
    expect(consent.pending()).toBe(true);

    TestBed.inject(CookieService).set(
      CONSENT_COOKIE,
      encodeConsent(['analytics'])
    );

    expect(consent.pending()).toBe(false);
    expect(consent.isGranted('analytics')).toBe(true);
  });

  it('withdraws a grant when the visitor rejects later', () => {
    const consent = TestBed.inject(ConsentService);
    consent.decide(['analytics']);

    consent.decide([]);

    expect(consent.pending()).toBe(false);
    expect(consent.isGranted('analytics')).toBe(false);
  });
});
