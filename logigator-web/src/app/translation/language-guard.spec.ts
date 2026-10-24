import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { configureTestBed } from '../../testing/configure-test-bed';
import { TranslationService } from './translation.service';

describe('languageTableGuard', () => {
  beforeEach(() => {
    configureTestBed();
  });

  it('follows the URL, in either direction', async () => {
    // Every navigation carries the language, the browser's own history entries
    // included: a page reached by going back must not be left in the language
    // the visitor switched to after leaving it.
    const router = TestBed.inject(Router);
    const translation = TestBed.inject(TranslationService);

    await router.navigateByUrl('/de/features');
    expect(translation.getActiveLang()).toBe('de');
    expect(document.documentElement.lang).toBe('de');

    await router.navigateByUrl('/en/features');
    expect(translation.getActiveLang()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });
});
