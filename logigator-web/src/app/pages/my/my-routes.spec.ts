import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  type TestRequest
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import type { UserResponse } from '@logigator/contract';
import { EMPTY_PAGE } from '../../../testing/community-rows';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { SessionService } from '../../user/session.service';

const USER: UserResponse = {
  id: '00000000-0000-4000-8000-000000000000',
  username: 'ada',
  email: 'ada@example.com',
  emailVerified: true,
  avatar: null,
  memberSince: '2026-01-01T00:00:00.000Z',
  hasPassword: true,
  googleLinked: false
};

describe('the my-area routes', () => {
  let http: HttpTestingController;
  let router: Router;

  /**
   * Waits for a guard's read to go out. A navigation runs its guards over
   * several microtasks — the language table is a dynamic import, and the
   * shelf's guard runs after it — so a request cannot be expected in the same
   * turn the navigation was started in.
   */
  async function waitForRequest(
    matches: (url: string) => boolean
  ): Promise<TestRequest> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const [request] = http.match((candidate) => matches(candidate.url));
      if (request) return request;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error('no matching request was made');
  }

  function signedIn(): void {
    configureTestBed([
      {
        provide: SessionService,
        useValue: { user: () => USER, resolve: () => Promise.resolve() }
      }
    ]);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  /**
   * Both controls on a shelf write a query parameter, and the router's default
   * only re-runs a guard when a *path* parameter changes — so without
   * `runGuardsAndResolvers` a paginator click rewrites the URL and leaves the
   * rows exactly where they were.
   */
  it('re-reads the shelf when only a query parameter changed', async () => {
    signedIn();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);

    const first = router.navigateByUrl('/en/my/projects');
    (await waitForRequest((url) => url === '/api/projects')).flush(EMPTY_PAGE);
    await first;

    const second = router.navigateByUrl('/en/my/projects?page=3&search=adder');
    const request = await waitForRequest((url) => url === '/api/projects');
    request.flush(EMPTY_PAGE);
    await second;

    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('search')).toBe('adder');
  });

  /**
   * `authGuard` runs before the listing's, so an anonymous visitor costs no
   * read of the shelf at all — the only request is the sign-in page's own — and
   * lands on the form with the shelf as the return path.
   */
  it('sends an anonymous visitor to sign in without reading the shelf', async () => {
    configureTestBed();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);

    const navigation = router.navigateByUrl('/en/my/components?page=2');
    // The sign-in page resolves the deployment's methods before it activates.
    (await waitForRequest((url) => url === '/api/meta')).flush({
      fileVersion: 1,
      authProviders: ['local']
    });
    await navigation;

    expect(router.url).toBe(
      '/en/login?returnUrl=%2Fen%2Fmy%2Fcomponents%3Fpage%3D2'
    );
    expect(
      http.match((request) => request.url.startsWith('/api/components'))
    ).toHaveLength(0);
  });
});
