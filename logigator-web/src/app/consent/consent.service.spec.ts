import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PLATFORM_ID, REQUEST } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CONSENT_COOKIE, encodeConsent } from '@logigator/core';
import { configureTestBed } from '../../testing/configure-test-bed';
import { ConsentService } from './consent.service';

function clearCookies(): void {
  document.cookie = `${CONSENT_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

describe('ConsentService', () => {
  beforeEach(clearCookies);

  afterEach(() => {
    TestBed.resetTestingModule();
    clearCookies();
  });

  it('reads the decision off the request during a server render', () => {
    // What leaves the banner out of the first byte for a visitor who decided.
    configureTestBed([
      { provide: PLATFORM_ID, useValue: 'server' },
      {
        provide: REQUEST,
        useValue: new Request('http://localhost/en', {
          headers: {
            cookie: `${CONSENT_COOKIE}=${encodeConsent(['analytics'])}`
          }
        })
      }
    ]);
    const consent = TestBed.inject(ConsentService);

    expect(consent.pending()).toBe(false);
    expect(consent.isGranted('analytics')).toBe(true);
  });

  it('keeps a decision for the next page view', () => {
    configureTestBed();
    const first = TestBed.inject(ConsentService);
    expect(first.pending()).toBe(true);

    first.decide(['analytics']);
    expect(first.pending()).toBe(false);

    TestBed.resetTestingModule();
    configureTestBed();
    expect(TestBed.inject(ConsentService).isGranted('analytics')).toBe(true);
  });
});
