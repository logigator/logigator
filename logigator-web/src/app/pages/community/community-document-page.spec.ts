import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { RETURN_PATH_PARAM } from '@logigator/core';
import { communityRow } from '../../../testing/community-rows';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { TranslationService } from '../../translation/translation.service';
import { SessionService } from '../../user/session.service';
import { CommunityDocumentPage } from './community-document-page';
import { CommunityDocumentService } from './community-document.service';

const LINK = '11111111-1111-4111-8111-111111111111';
const DETAIL_URL = `/api/community/projects/${LINK}`;
const PAGE_PATH = `/en/community/projects/${LINK}`;

describe('CommunityDocumentPage', () => {
  let http: HttpTestingController;

  async function render(
    patch: Record<string, unknown> = {},
    fail?: { status: number; body: object }
  ): Promise<{ el: HTMLElement; detectChanges: () => void }> {
    const resolved = TestBed.inject(CommunityDocumentService).resolve(
      'projects',
      LINK
    );
    const request = http.expectOne(DETAIL_URL);
    if (fail) {
      request.flush(fail.body, { status: fail.status, statusText: 'x' });
    } else {
      request.flush({
        ...communityRow('Half adder', LINK, patch),
        forkedFrom: null
      });
    }
    await resolved;

    await TestBed.inject(TranslationService).setActiveLang('en');

    const fixture = TestBed.createComponent(CommunityDocumentPage);
    fixture.detectChanges();
    return {
      el: fixture.nativeElement,
      detectChanges: () => fixture.detectChanges()
    };
  }

  function button(el: HTMLElement, label: string): HTMLButtonElement {
    const found = [...el.querySelectorAll('button')].find((candidate) =>
      candidate.textContent?.includes(label)
    );
    expect(found, `no button labelled ${label}`).toBeDefined();
    return found!;
  }

  /**
   * Puts the router on this page and intercepts where it goes next. Reading
   * `router.url` rather than navigating for real: activating the route would
   * run its guard, and the request that guard makes is the one the spec has
   * already answered by hand.
   */
  function onThisPage(): ReturnType<typeof vi.spyOn> {
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'url', 'get').mockReturnValue(PAGE_PATH);
    return vi.spyOn(router, 'navigate').mockResolvedValue(true);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    configureTestBed();
    http = TestBed.inject(HttpTestingController);
  });

  /**
   * A visitor who wants to star has to sign in first, and has to come back to
   * the circuit they were looking at — a redirect home would make them find it
   * again, which is the whole point of the return path.
   */
  it('sends a signed-out reader to sign in, and back here afterwards', async () => {
    const { el } = await render();
    const navigate = onThisPage();

    button(el, 'Star').click();

    expect(navigate).toHaveBeenCalledWith(['/en/login'], {
      queryParams: { [RETURN_PATH_PARAM]: PAGE_PATH }
    });
    // No request went out: a star with no session is a 401, not a state.
    http.expectNone(`${DETAIL_URL}/star`);
  });

  it('sends a signed-out reader to sign in before cloning too', async () => {
    const { el } = await render();
    const navigate = onThisPage();

    button(el, 'Save a copy').click();

    expect(navigate).toHaveBeenCalledWith(['/en/login'], {
      queryParams: { [RETURN_PATH_PARAM]: PAGE_PATH }
    });
    http.expectNone(`/api/share/${LINK}/clone`);
  });

  it('stars for a signed-in reader and shows the count the server returned', async () => {
    const { el, detectChanges } = await render({ stars: 12, starred: false });
    TestBed.inject(SessionService).signedIn({
      id: 'a',
      username: 'ada'
    } as never);
    detectChanges();

    button(el, 'Star').click();
    http.expectOne(`${DETAIL_URL}/star`).flush({ starred: true, stars: 13 });
    await Promise.resolve();
    detectChanges();

    expect(el.textContent).toContain('Starred');
    expect(el.textContent).toContain('13');
  });

  /**
   * The two controls sit beside each other, so what is in flight has to be
   * *which* action rather than whether one is — a shared boolean spins the
   * button the reader did not press.
   */
  it('busies only the control that was pressed', async () => {
    const { el, detectChanges } = await render();
    TestBed.inject(SessionService).signedIn({
      id: 'a',
      username: 'ada'
    } as never);
    detectChanges();

    button(el, 'Star').click();
    detectChanges();

    expect(button(el, 'Star').disabled).toBe(true);
    expect(button(el, 'Save a copy').disabled).toBe(false);

    http.expectOne(`${DETAIL_URL}/star`).flush({ starred: true, stars: 1 });
    await Promise.resolve();
    detectChanges();
    expect(button(el, 'Starred').disabled).toBe(false);
  });

  /**
   * A share token that was regenerated leaves exactly this URL behind, so the
   * page is a real 404 rather than a section that failed — a soft 404 stays
   * indexed, and a crawler has no other way to learn the URL is dead.
   */
  it('renders the site’s 404 for a link that names nothing published', async () => {
    const { el } = await render(
      {},
      { status: 404, body: { code: 'not_found', message: 'gone' } }
    );

    expect(el.textContent).toContain('404');
    expect(el.querySelector('h1')?.textContent).toContain('Page not found');
  });

  it('keeps the page with a retry when the read failed for another reason', async () => {
    const { el } = await render(
      {},
      {
        status: 503,
        body: { code: 'service_unavailable', message: 'down' }
      }
    );

    expect(el.textContent).not.toContain('404');
    expect(el.querySelector('[role=alert]')).not.toBeNull();
    expect(el.textContent).toContain('Retry');
  });

  it('names the parent a fork was built on, and links its page', async () => {
    const parent = '22222222-2222-4222-8222-222222222222';
    const resolved = TestBed.inject(CommunityDocumentService).resolve(
      'projects',
      LINK
    );
    http.expectOne(DETAIL_URL).flush({
      ...communityRow('Half adder', LINK),
      forkedFrom: {
        id: parent,
        name: 'Adder',
        link: parent,
        authorName: 'ada'
      }
    });
    await resolved;
    await TestBed.inject(TranslationService).setActiveLang('en');

    const fixture = TestBed.createComponent(CommunityDocumentPage);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    // Named even where the parent is no longer public: withholding the credit
    // because somebody unpublished would turn a fork into original work.
    expect(el.textContent).toContain('Forked from');
    expect(
      [...el.querySelectorAll('a')].map((link) => link.getAttribute('href'))
    ).toContain(`/en/community/projects/${parent}`);
  });
});
