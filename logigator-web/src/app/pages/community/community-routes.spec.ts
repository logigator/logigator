import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  type TestRequest
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import type {
  CommunityProjectDetail,
  DocumentVisibility
} from '@logigator/contract';
import {
  communityRow,
  EMPTY_PAGE,
  publicProfile
} from '../../../testing/community-rows';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { PageMeta } from '../../seo/seo.service';
import { communityRoutes } from './community-routes';
import { CommunityDocumentService } from './community-document.service';

const USER = '33333333-3333-4333-8333-333333333333';
const LINK = '11111111-1111-4111-8111-111111111111';

/** One detail row, as the guard's read answers it. */
function detail(patch: {
  visibility: DocumentVisibility;
}): CommunityProjectDetail {
  return { ...communityRow('Half adder', LINK, patch), forkedFrom: null };
}

/**
 * The `noindex` the document route declares. Read off the route tree rather
 * than imported: the factory is route data, and a route tree that lost it
 * would otherwise be a head that indexes what it should not.
 */
function documentRouteNoindex(): () => boolean {
  const route = communityRoutes.find(
    (candidate) => candidate.path === 'community/projects/:link'
  );
  const noindex = (route?.data as { seo?: PageMeta } | undefined)?.seo?.noindex;
  expect(noindex, 'the document route declares no noindex').toBeDefined();
  return noindex!;
}

/** The stargazer route's head, read off the tree for the same reason. */
function stargazersRouteSeo(): PageMeta {
  const route = communityRoutes.find(
    (candidate) => candidate.path === 'community/projects/:link/stargazers'
  );
  const seo = (route?.data as { seo?: PageMeta } | undefined)?.seo;
  expect(seo, 'the stargazer route declares no head').toBeDefined();
  return seo!;
}

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
    ).flush(
      publicProfile({ id: USER, publicProjects: 0, publicComponents: 0 })
    );
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
    ).flush(
      publicProfile({ id: USER, publicProjects: 0, publicComponents: 0 })
    );
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

  /**
   * One URL, two answers. A document's own page is a search result or not
   * depending on what its guard resolved, which the route definition cannot
   * know — so the head asks the page, and the page is looked at again on every
   * render rather than answered once at startup.
   */
  it('keeps a document’s page out of the index in every state but public', async () => {
    const noindex = documentRouteNoindex();
    const content = TestBed.inject(CommunityDocumentService);

    const published = content.resolve('projects', LINK);
    http
      .expectOne(`/api/community/projects/${LINK}`)
      .flush(detail({ visibility: 'public' }));
    await published;
    expect(TestBed.runInInjectionContext(noindex)).toBe(false);

    const unlisted = content.resolve('projects', LINK);
    http
      .expectOne(`/api/community/projects/${LINK}`)
      .flush(detail({ visibility: 'unlisted' }));
    await unlisted;
    expect(TestBed.runInInjectionContext(noindex)).toBe(true);

    const priv = content.resolve('projects', LINK);
    http
      .expectOne(`/api/community/projects/${LINK}`)
      .flush(detail({ visibility: 'private' }));
    await priv;
    expect(TestBed.runInInjectionContext(noindex)).toBe(true);
  });

  /**
   * The stargazer page's head is route data, so it has to follow the page: for
   * a document the community does not list that page is the site's 404, and a
   * `BreadcrumbList` step naming the document — or a card drawing it — would
   * describe a page the reader is not on. The list itself is the one state
   * where both belong.
   */
  it('names the document in the stargazer page’s head only where that page exists', async () => {
    const seo = stargazersRouteSeo();
    const content = TestBed.inject(CommunityDocumentService);
    const trail = () => TestBed.runInInjectionContext(() => seo.trail!());
    const image = () => TestBed.runInInjectionContext(() => seo.image!());

    const published = content.resolve('projects', LINK);
    http
      .expectOne(`/api/community/projects/${LINK}`)
      .flush(detail({ visibility: 'public' }));
    await published;
    expect(trail()).not.toEqual([]);
    expect(image()).not.toBeNull();

    const unlisted = content.resolve('projects', LINK);
    http
      .expectOne(`/api/community/projects/${LINK}`)
      .flush(detail({ visibility: 'unlisted' }));
    await unlisted;
    expect(trail()).toEqual([]);
    expect(image()).toBeNull();

    const priv = content.resolve('projects', LINK);
    http
      .expectOne(`/api/community/projects/${LINK}`)
      .flush(detail({ visibility: 'private' }));
    await priv;
    expect(trail()).toEqual([]);
    expect(image()).toBeNull();
  });
});
