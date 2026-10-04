import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { communityRow, EMPTY_PAGE } from '../../../testing/community-rows';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { TranslationService } from '../../translation/translation.service';
import { CommunityBrowsePage } from './community-browse-page';
import { CommunityBrowseService } from './community-browse.service';
import { DEFAULT_ORDER } from './listing-query';

const LINK = '22222222-2222-4222-8222-222222222222';

describe('CommunityBrowsePage', () => {
  let http: HttpTestingController;

  /** Answers the read the guard makes, then renders the page. */
  async function render(
    query: { search?: string } = {},
    answer: object = EMPTY_PAGE
  ): Promise<HTMLElement> {
    const resolved = TestBed.inject(CommunityBrowseService).resolve(
      'projects',
      { page: 0, search: query.search ?? '', orderBy: DEFAULT_ORDER }
    );
    http
      .expectOne((request) => request.url === '/api/community/projects')
      .flush(answer);
    await resolved;

    await TestBed.inject(TranslationService).setActiveLang('en');
    const fixture = TestBed.createComponent(CommunityBrowsePage);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    configureTestBed();
    http = TestBed.inject(HttpTestingController);
  });

  /**
   * Whose emptiness it is decides the words and whether there is an action at
   * all. A filter that matched nothing offers to clear itself; an empty table
   * must not offer that, and must not offer a create action either — the thing
   * the reader wanted may well exist.
   */
  it('offers to clear a filter that matched nothing', async () => {
    const el = await render({ search: 'adder' });

    expect(el.textContent).toContain('Nothing found');
    expect(el.textContent).toContain('“adder”');
    expect(el.textContent).toContain('Clear the search');
  });

  it('says only that an unfiltered listing is empty', async () => {
    const el = await render();

    expect(el.textContent).toContain('Nothing here yet');
    expect(el.textContent).not.toContain('Clear the search');
  });

  /**
   * The filter is a real GET form and the rankings are links, so the page
   * browses before any script has run — which is also what a crawler follows.
   */
  it('filters and ranks without JavaScript', async () => {
    const el = await render();

    const form = el.querySelector('form[role=search]')!;
    expect(form.getAttribute('method')).toBe('get');
    expect(form.getAttribute('action')).toBe('/en/community/projects');
    expect(form.querySelector('input[name=search]')).not.toBeNull();

    const rankings = [...el.querySelectorAll('a[href*="orderBy"]')].map(
      (link) => link.getAttribute('href')
    );
    expect(rankings).toEqual([
      '/en/community/projects?orderBy=stars',
      '/en/community/projects?orderBy=latest'
    ]);
  });

  it('leaves the default ranking’s link without a parameter', async () => {
    // The canonical drops `orderBy`, so the default view has to be the plain
    // URL or a share of it would report a page the canonical disowns.
    const el = await render();

    const trending = [...el.querySelectorAll('a')].find(
      (link) => link.textContent?.trim() === 'Trending'
    );
    expect(trending?.getAttribute('href')).toBe('/en/community/projects');
  });

  it('sends a row to its own page and its author to theirs', async () => {
    const el = await render(
      {},
      {
        ...EMPTY_PAGE,
        entries: [communityRow('8-Bit ALU', LINK)],
        total: 1
      }
    );

    const hrefs = [...el.querySelectorAll('a')].map((link) =>
      link.getAttribute('href')
    );
    expect(hrefs).toContain(`/en/community/projects/${LINK}`);
    expect(hrefs).toContain(
      '/en/community/users/33333333-3333-4333-8333-333333333333'
    );
  });
});
