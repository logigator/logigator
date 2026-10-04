import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  type TestRequest
} from '@angular/common/http/testing';
import { RESPONSE_INIT } from '@angular/core';
import type { Author, DocumentVisibility } from '@logigator/contract';
import { communityRow } from '../../../testing/community-rows';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { TranslationService } from '../../translation/translation.service';
import { SessionService } from '../../user/session.service';
import { CommunityDocumentService } from './community-document.service';
import { STARGAZER_PAGE_SIZE } from './listing-query';
import { StargazersPage } from './stargazers-page';
import { StargazersService } from './stargazers.service';

const LINK = '11111111-1111-4111-8111-111111111111';
const USER = '33333333-3333-4333-8333-333333333333';
const DETAIL_URL = `/api/community/projects/${LINK}`;
const LIST_URL = `${DETAIL_URL}/stargazers`;

/** One row of the list, as `GET …/stargazers` answers it. */
const STARGAZER: Author = { id: USER, username: 'marek_h', avatar: null };

/** The one page of stargazers the read answers with. */
const STARS = {
  entries: [STARGAZER],
  page: 0,
  pageSize: STARGAZER_PAGE_SIZE,
  total: 1
};

const NO_STARS = { ...STARS, entries: [], total: 0 };

/** The two failures a read can come back as *and* the page has to tell apart. */
const GONE = { status: 404, body: { code: 'not_found', message: 'gone' } };
const DOWN = {
  status: 503,
  body: { code: 'service_unavailable', message: 'down' }
};

function fail(request: TestRequest, failure: { status: number; body: object }) {
  request.flush(failure.body, { status: failure.status, statusText: 'x' });
}

describe('StargazersPage', () => {
  let http: HttpTestingController;
  /** The response the server render would carry, which the 404 has to set. */
  let responseInit: { status: number };

  /**
   * Answers the two reads the route's guards make — the document first, then
   * the list — and renders the page.
   *
   * The list read carries `visibility = 'public'` the way the listings do, so
   * a document that is not public has no list for the API to answer with: its
   * cases hand in the `404` it answers with, which is the answer the page has
   * to be right about rather than one of its own invention.
   */
  async function render(
    visibility: DocumentVisibility,
    answers: {
      documentFailure?: { status: number; body: object };
      list?: object;
      listFailure?: { status: number; body: object };
    } = {}
  ): Promise<HTMLElement> {
    const documents = TestBed.inject(CommunityDocumentService);
    const read = documents.resolve('projects', LINK);
    const detail = http.expectOne(DETAIL_URL);
    if (answers.documentFailure) {
      fail(detail, answers.documentFailure);
    } else {
      detail.flush({
        ...communityRow('Half adder', LINK, { visibility }),
        forkedFrom: null
      });
    }
    await read;

    const listed = TestBed.inject(StargazersService).resolve(
      'projects',
      LINK,
      0
    );
    // The page and its size are query parameters, so the URL is matched by its
    // path rather than whole.
    const list = http.expectOne((request) => request.url.startsWith(LIST_URL));
    if (answers.listFailure) {
      fail(list, answers.listFailure);
    } else {
      list.flush(answers.list ?? STARS);
    }
    await listed;

    await TestBed.inject(TranslationService).setActiveLang('en');
    const fixture = TestBed.createComponent(StargazersPage);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  function hrefs(el: HTMLElement): (string | null)[] {
    return [...el.querySelectorAll('a')].map((link) =>
      link.getAttribute('href')
    );
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    responseInit = { status: 200 };
    configureTestBed([{ provide: RESPONSE_INIT, useValue: responseInit }]);
    http = TestBed.inject(HttpTestingController);
  });

  it('lists the people who starred a published document', async () => {
    const el = await render('public');

    // The page is that document's stargazers, so it names it and shows them.
    expect(el.textContent).toContain('Half adder');
    expect(el.textContent).toContain('marek_h');
    expect(hrefs(el)).toContain(`/en/community/users/${USER}`);
    expect(el.textContent).not.toContain('Page not found');
    expect(responseInit.status).toBe(200);
  });

  it('says a published document has no stars yet rather than that it is nowhere', async () => {
    // An empty list is a statement about a document the community has; only
    // `not_found` means there is no document to list at all.
    const el = await render('public', { list: NO_STARS });

    expect(el.textContent).toContain('No stars yet');
    expect(el.textContent).not.toContain('Page not found');
    expect(responseInit.status).toBe(200);
  });

  /**
   * The state this page got wrong: the document guard admits an unlisted
   * document for whoever holds its link, while the list it pages with is
   * public-only — so the page was a 200 that named the document and then
   * offered a retry for a `404` that would never become anything else. A
   * document the community does not list has no stargazers, and the page the
   * site uses for "nothing here" is the honest answer for it.
   */
  it('answers the site’s 404 for an unlisted document', async () => {
    const el = await render('unlisted', { listFailure: GONE });

    expect(el.textContent).toContain('Page not found');
    // Nothing names the document: the heading and the trail a crawler would
    // read are the 404's, so this URL says nothing about which circuit it is.
    expect(el.textContent).not.toContain('Half adder');
    // The status is the half of the answer a crawler actually reads.
    expect(responseInit.status).toBe(404);
  });

  it('answers it for the owner of a private document too', async () => {
    // The reader a private document is reachable by — and the one a page
    // offering a retry would waste the most time on, since there is no list
    // for them either.
    TestBed.inject(SessionService).signedIn({
      id: USER,
      username: 'marek_h'
    } as never);
    const el = await render('private', { listFailure: GONE });

    expect(el.textContent).toContain('Page not found');
    expect(el.textContent).not.toContain('Half adder');
    expect(responseInit.status).toBe(404);
  });

  it('keeps the page and a retry where the document read failed', async () => {
    // The other side of the rule: a read that failed says nothing about the
    // document, so the reader gets the retry rather than a 404 the page cannot
    // vouch for.
    const el = await render('public', { documentFailure: DOWN });

    expect(el.textContent).not.toContain('Page not found');
    expect(el.textContent).toContain('Retry');
    expect(responseInit.status).toBe(200);
  });

  it('keeps a failed list on a published document’s own page', async () => {
    // The document is in the community, so this page is the one for it: its
    // list failing is a section that failed, not a page that is not there.
    const el = await render('public', { listFailure: DOWN });

    expect(el.textContent).toContain('The stargazers could not be loaded');
    expect(el.textContent).toContain('Retry');
    expect(el.textContent).not.toContain('Page not found');
  });
});
