import { beforeEach, describe, expect, it } from 'vitest';
import { DOCUMENT, RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  type TestRequest
} from '@angular/common/http/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { EXAMPLES_ACCOUNT_ID } from '@logigator/core';
import { communityRow, publicProfile } from '../../testing/community-rows';
import { configureTestBed } from '../../testing/configure-test-bed';

const LINK = '11111111-1111-4111-8111-111111111111';
const USER = '33333333-3333-4333-8333-333333333333';
const DETAIL_URL = `/api/community/projects/${LINK}`;
const PROFILE_URL = `/api/community/users/${USER}`;

const GONE = { status: 404, body: { code: 'not_found', message: 'gone' } };
const DOWN = {
  status: 503,
  body: { code: 'service_unavailable', message: 'down' }
};
const UNREACHABLE = { status: 0, body: {} };

type Failure = typeof GONE;

/** A published document that passes the indexing rule on its own merits. */
const PUBLISHED = {
  ...communityRow('Half adder', LINK, {
    description: 'Adds two bits.',
    componentCount: 40,
    wireCount: 60
  }),
  forkedFrom: null
};

/**
 * The status line and head a crawler reads for one community URL, with every
 * read its guards make answered in order — rendered through the router, since
 * the 404 is set by the page that draws it and `noindex` by the route.
 */
describe('the status a page answers with', () => {
  let http: HttpTestingController;
  let responseInit: ResponseInit & { status: number };

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

  async function visit(
    url: string,
    answers: { path: string; answer: object | Failure }[]
  ): Promise<{ retryAfter: string | null; noindex: boolean }> {
    const harness = await RouterTestingHarness.create();
    const navigated = harness.navigateByUrl(url);
    for (const { path, answer } of answers) {
      const request = await waitForRequest((candidate) => candidate === path);
      if ('status' in answer && 'body' in answer) {
        request.flush(answer.body, { status: answer.status, statusText: 'x' });
      } else {
        request.flush(answer);
      }
    }
    await navigated;
    harness.detectChanges();

    const robots = TestBed.inject(DOCUMENT)
      .head.querySelector('meta[name="robots"]')
      ?.getAttribute('content');
    return {
      retryAfter: new Headers(responseInit.headers).get('retry-after'),
      noindex: robots?.includes('noindex') ?? false
    };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    responseInit = { status: 200 };
    configureTestBed([{ provide: RESPONSE_INIT, useValue: responseInit }]);
    http = TestBed.inject(HttpTestingController);
  });

  it('answers a published document with 200, indexable', async () => {
    const page = await visit(`/en/community/projects/${LINK}`, [
      { path: DETAIL_URL, answer: PUBLISHED }
    ]);

    expect(responseInit.status).toBe(200);
    expect(page).toEqual({ retryAfter: null, noindex: false });
  });

  it('answers a link naming nothing with 404 and noindex', async () => {
    const page = await visit(`/en/community/projects/${LINK}`, [
      { path: DETAIL_URL, answer: GONE }
    ]);

    expect(responseInit.status).toBe(404);
    expect(page).toEqual({ retryAfter: null, noindex: true });
  });

  /**
   * The API restarting, or migrating, must not read as the page saying it does
   * not belong in an index: a crawler would drop every community page it
   * fetched in that window.
   */
  it.each([
    ['answers', DOWN],
    ['is unreachable', UNREACHABLE]
  ])('answers 503 and stays indexable when the API %s', async (_, failure) => {
    const page = await visit(`/en/community/projects/${LINK}`, [
      { path: DETAIL_URL, answer: failure }
    ]);

    expect(responseInit.status).toBe(503);
    expect(page.noindex).toBe(false);
    expect(Number(page.retryAfter)).toBeGreaterThan(0);
  });

  it('answers a member that does not exist with 404 and noindex', async () => {
    const page = await visit(`/en/community/users/${USER}`, [
      { path: PROFILE_URL, answer: GONE },
      { path: `${PROFILE_URL}/projects`, answer: GONE }
    ]);

    expect(responseInit.status).toBe(404);
    expect(page.noindex).toBe(true);
  });

  it('answers a member whose read failed with 503, indexable', async () => {
    const page = await visit(`/en/community/users/${USER}`, [
      { path: PROFILE_URL, answer: DOWN },
      { path: `${PROFILE_URL}/projects`, answer: DOWN }
    ]);

    expect(responseInit.status).toBe(503);
    expect(page.noindex).toBe(false);
    expect(page.retryAfter).not.toBeNull();
  });

  it('answers a member tab whose listing failed with 503', async () => {
    const page = await visit(`/en/community/users/${USER}/components`, [
      {
        path: PROFILE_URL,
        answer: publicProfile({ id: USER, bio: 'I build CPUs.' })
      },
      { path: `${PROFILE_URL}/components`, answer: DOWN }
    ]);

    expect(responseInit.status).toBe(503);
    expect(page.noindex).toBe(false);
  });

  it('answers a stargazer list whose document read failed with 503', async () => {
    await visit(`/en/community/projects/${LINK}/stargazers`, [
      { path: DETAIL_URL, answer: DOWN },
      { path: `${DETAIL_URL}/stargazers`, answer: DOWN }
    ]);

    expect(responseInit.status).toBe(503);
    expect(new Headers(responseInit.headers).has('retry-after')).toBe(true);
  });

  it('answers a stargazer list that failed on its own with 503', async () => {
    await visit(`/en/community/projects/${LINK}/stargazers`, [
      { path: DETAIL_URL, answer: PUBLISHED },
      { path: `${DETAIL_URL}/stargazers`, answer: DOWN }
    ]);

    expect(responseInit.status).toBe(503);
  });

  it('answers a browse listing whose read failed with 503', async () => {
    await visit('/en/community/projects', [
      { path: '/api/community/projects', answer: DOWN }
    ]);

    expect(responseInit.status).toBe(503);
  });

  it('answers the examples page whose read failed with 503', async () => {
    await visit('/en/examples', [
      {
        path: `/api/community/users/${EXAMPLES_ACCOUNT_ID}/projects`,
        answer: DOWN
      }
    ]);

    expect(responseInit.status).toBe(503);
  });

  /**
   * The home page is the site's own words with three listings beside them, so
   * a listing that failed is a section of it, not the page.
   */
  it('keeps the home page a 200 when its listings fail', async () => {
    const harness = await RouterTestingHarness.create();
    const navigated = harness.navigateByUrl('/en');
    const reads: TestRequest[] = [];
    for (let attempt = 0; reads.length < 3 && attempt < 50; attempt++) {
      reads.push(
        ...http.match((request) => request.url.startsWith('/api/community/'))
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    for (const read of reads) {
      read.flush(DOWN.body, { status: DOWN.status, statusText: 'x' });
    }
    await navigated;
    harness.detectChanges();

    expect(responseInit.status).toBe(200);
    expect(responseInit.headers).toBeUndefined();
    http.verify();
  });
});
