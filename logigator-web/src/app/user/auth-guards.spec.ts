import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { configureTestBed } from '../../testing/configure-test-bed';
import { SessionService } from './session.service';
import { authGuard, guestGuard } from './auth-guards';

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

    /**
     * A signed-in visitor reaches the sign-in page only from a Google round
     * trip that was a *link*: the API answers every failure on the configured
     * sign-in URL, whichever the flow was for. Dropping the reason with the
     * page would leave the account page silent about a link that failed.
     */
    it('carries a failed round trip’s reason to the page that started it', () => {
      const tree = runGuard({
        returnUrl: '/en/my/account',
        error: 'google_already_linked'
      });
      expect(TestBed.inject(Router).serializeUrl(tree as UrlTree)).toBe(
        '/en/my/account?error=google_already_linked'
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

describe('authGuard', () => {
  function runAuthGuard(url: string): true | UrlTree {
    return TestBed.runInInjectionContext(
      () =>
        authGuard({} as ActivatedRouteSnapshot, { url } as never) as
          true | UrlTree
    );
  }

  it('sends an anonymous visitor to sign in, keeping where they were going', () => {
    configureTestBed();
    const tree = runAuthGuard('/de/my/projects?page=3');

    // A `UrlTree` is what @angular/ssr turns into a real 302, the rendered URL
    // then differing from the one asked for.
    expect(TestBed.inject(Router).serializeUrl(tree as UrlTree)).toBe(
      '/en/login?returnUrl=%2Fde%2Fmy%2Fprojects%3Fpage%3D3'
    );
  });

  it('lets a signed-in visitor through', () => {
    configureTestBed([
      {
        provide: SessionService,
        useValue: { user: () => USER, resolve: () => Promise.resolve() }
      }
    ]);
    expect(runAuthGuard('/en/my/account')).toBe(true);
  });
});
