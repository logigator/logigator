import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { configureTestBed } from '../../testing/configure-test-bed';
import { SessionService } from './session.service';
import { guestGuard } from './auth-guards';

const USER = {
  id: '00000000-0000-4000-8000-000000000000',
  username: 'ada',
  email: 'ada@example.com',
  emailVerified: true,
  avatar: null,
  memberSince: '2026-01-01T00:00:00.000Z',
  hasPassword: true,
  googleLinked: false
};

/** A snapshot carrying nothing but the query the guard reads. */
function snapshotWith(query: Record<string, string>): ActivatedRouteSnapshot {
  return { queryParamMap: convertToParamMap(query) } as ActivatedRouteSnapshot;
}

function runGuard(query: Record<string, string>): true | UrlTree {
  return TestBed.runInInjectionContext(
    () =>
      guestGuard(snapshotWith(query), {
        url: '/en/login'
      } as never) as true | UrlTree
  );
}

describe('guestGuard', () => {
  describe('signed in', () => {
    beforeEach(() => {
      configureTestBed([
        {
          provide: SessionService,
          // `resolve` too: the app's own initializer calls it before anything
          // in the injector is reachable.
          useValue: { user: () => USER, resolve: () => Promise.resolve() }
        }
      ]);
    });

    it('sends the visitor to the destination the sign-in page was for', () => {
      const tree = runGuard({ returnUrl: '/de/community/projects?page=2' });
      expect(TestBed.inject(Router).serializeUrl(tree as UrlTree)).toBe(
        '/de/community/projects?page=2'
      );
    });

    it('ignores a destination that is not a path on this origin', () => {
      const tree = runGuard({ returnUrl: '//evil.test/phish' });
      expect(TestBed.inject(Router).serializeUrl(tree as UrlTree)).toBe('/en');
    });
  });

  it('lets an anonymous visitor through', () => {
    configureTestBed();
    expect(runGuard({})).toBe(true);
  });
});
