import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  type TestRequest
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { EMPTY_PAGE } from '../../../testing/community-rows';
import { configureTestBed } from '../../../testing/configure-test-bed';

const USER = '33333333-3333-4333-8333-333333333333';

describe('the community routes', () => {
  let http: HttpTestingController;
  let router: Router;

  /**
   * Waits for a guard's read to go out. A navigation runs its guards over
   * several microtasks — the language table is a dynamic import, and the
   * community guard runs after it — so a request cannot be expected in the
   * same turn the navigation was started in.
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

  /** The one read the activating guard makes, answered as an empty page. */
  async function answerListing(): Promise<TestRequest> {
    const request = await waitForRequest((url) =>
      url.startsWith('/api/community/')
    );
    request.flush(EMPTY_PAGE);
    return request;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    configureTestBed();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  /**
   * Every control on a browse page writes a query parameter, and the router's
   * default only re-runs a guard when a *path* parameter changes — so without
   * `runGuardsAndResolvers` a paginator click rewrites the URL and leaves the
   * rows exactly where they were.
   */
  it('re-reads the listing when only a query parameter changed', async () => {
    const first = router.navigateByUrl('/en/community/projects');
    await answerListing();
    await first;

    const second = router.navigateByUrl(
      '/en/community/projects?page=3&orderBy=latest'
    );
    const request = await answerListing();
    await second;

    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('orderBy')).toBe('latest');
  });

  /**
   * A profile's header is resolved on the parent and its listing on the child,
   * so moving between tabs re-reads only the list — and the header, which says
   * whose page this is, is not fetched four times over.
   */
  it('reads a profile once and its tabs one at a time', async () => {
    const opened = router.navigateByUrl(`/en/community/users/${USER}`);
    (
      await waitForRequest((url) => url === `/api/community/users/${USER}`)
    ).flush({
      id: USER,
      username: 'marek_h',
      avatar: null,
      memberSince: '2024-03-09T00:00:00.000Z',
      publicProjects: 0,
      publicComponents: 0
    });
    (
      await waitForRequest(
        (url) => url === `/api/community/users/${USER}/projects`
      )
    ).flush(EMPTY_PAGE);
    await opened;

    const switched = router.navigateByUrl(
      `/en/community/users/${USER}/starred/components`
    );
    (
      await waitForRequest(
        (url) => url === `/api/community/users/${USER}/starred/components`
      )
    ).flush(EMPTY_PAGE);
    await switched;

    // No second read of the member: the parent route did not re-activate.
    http.verify();
  });

  /**
   * The profile listing pages relatively — it is a child route, and the page
   * it belongs to is the parent's — where the browse and stargazer pages name
   * their path outright. A relative navigation that resolved against the wrong
   * tree would leave the tab and re-read nothing.
   */
  it('pages a profile tab without leaving it', async () => {
    const opened = router.navigateByUrl(
      `/en/community/users/${USER}/components`
    );
    (
      await waitForRequest((url) => url === `/api/community/users/${USER}`)
    ).flush({
      id: USER,
      username: 'marek_h',
      avatar: null,
      memberSince: '2024-03-09T00:00:00.000Z',
      publicProjects: 0,
      publicComponents: 0
    });
    (
      await waitForRequest(
        (url) => url === `/api/community/users/${USER}/components`
      )
    ).flush({ ...EMPTY_PAGE, total: 40 });
    await opened;

    // The call the listing makes, verbatim.
    const paged = router.navigate([], { queryParams: { page: '2' } });
    const request = await waitForRequest(
      (url) => url === `/api/community/users/${USER}/components`
    );
    request.flush(EMPTY_PAGE);
    await paged;

    expect(router.url).toBe(`/en/community/users/${USER}/components?page=2`);
    expect(request.request.params.get('page')).toBe('1');
  });

  it('sends a bare /community to the listing the bar links', async () => {
    const navigated = router.navigateByUrl('/en/community');
    await answerListing();
    await navigated;

    expect(router.url).toBe('/en/community/projects');
  });

  it('falls through to the 404 for a segment that names no page', async () => {
    await router.navigateByUrl('/en/community/nonsense');

    expect(router.url).toBe('/en/community/nonsense');
    http.verify();
  });
});
