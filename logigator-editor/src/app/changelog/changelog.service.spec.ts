import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { DialogService } from '@logigator/ui';
import { configureTestBed } from '../../testing/configure-test-bed';
import { environment } from '../../environments/environment';
import { CookieService } from '../storage/cookie.service';
import { ChangelogService } from './changelog.service';

const LAST_SEEN_KEY = 'logigator.changelog.lastSeenVersion';

describe('ChangelogService', () => {
  let service: ChangelogService;
  let http: HttpTestingController;
  let open: ReturnType<typeof vi.fn>;
  let cookies: Record<string, string>;

  beforeEach(() => {
    localStorage.removeItem(LAST_SEEN_KEY);
    cookies = {};
    open = vi.fn();
    configureTestBed([
      { provide: DialogService, useValue: { open } },
      {
        provide: CookieService,
        useValue: { get: (name: string) => cookies[name] ?? null }
      }
    ]);
    service = TestBed.inject(ChangelogService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Also asserts maybeAutoOpen never fetched the markdown just to check.
    http.verify();
    localStorage.removeItem(LAST_SEEN_KEY);
  });

  describe('isNewer', () => {
    it('compares across major, minor and patch', () => {
      expect(service.isNewer('2.1.0', '2.0.0')).toBe(true);
      expect(service.isNewer('2.0.1', '2.0.0')).toBe(true);
      expect(service.isNewer('3.0.0', '2.9.9')).toBe(true);
      expect(service.isNewer('2.0.0', '2.1.0')).toBe(false);
      expect(service.isNewer('2.0.0', '2.0.0')).toBe(false);
    });
  });

  describe('maybeAutoOpen', () => {
    it('acknowledges the running version silently for a brand-new user', () => {
      service.maybeAutoOpen();

      expect(open).not.toHaveBeenCalled();
      expect(localStorage.getItem(LAST_SEEN_KEY)).toBe(environment.version);
    });

    it('shows the changelog on first run for a returning old-editor user', () => {
      cookies['tutorials'] = 'j:["gettingStarted"]';

      service.maybeAutoOpen();

      expect(open).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(LAST_SEEN_KEY)).toBe(environment.version);
    });

    it('opens the dialog when the running version is unseen', () => {
      localStorage.setItem(LAST_SEEN_KEY, '0.0.1');

      service.maybeAutoOpen();

      expect(open).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(LAST_SEEN_KEY)).toBe(environment.version);
    });

    it('stays quiet when the running version has already been seen', () => {
      localStorage.setItem(LAST_SEEN_KEY, environment.version);

      service.maybeAutoOpen();

      expect(open).not.toHaveBeenCalled();
    });
  });
});
