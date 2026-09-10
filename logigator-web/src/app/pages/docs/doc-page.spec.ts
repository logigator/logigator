import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { DOC_PAGE_IDS } from '@logigator/docs';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { markdownPageNavigator } from '../../../testing/markdown-page-harness';

describe('the documentation pages', () => {
  beforeEach(() => {
    configureTestBed();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the page its route names, whole', async () => {
    const page = await (
      await markdownPageNavigator()
    )('/en/docs/getting-started');

    expect(page.querySelector('lg-markdown h1')?.textContent).toContain(
      'Getting Started'
    );
    expect(page.textContent).toContain('A tour of the editor');
  });

  it('follows a language switch, which is a navigation to the same page', async () => {
    const render = await markdownPageNavigator();
    expect((await render('/en/docs/cloud')).textContent).toContain(
      'Cloud & Sharing'
    );

    const german = await render('/de/docs/cloud');
    expect(german.textContent).toContain('Cloud & Teilen');
    expect(german.textContent).not.toContain('Cloud & Sharing');
  });

  /**
   * A `docs:` cross link is rewritten to the route its page is served at, in
   * the language being read: an anchor a crawler can follow is the reason
   * these pages are on the site rather than only inside the editor.
   */
  it('rewrites a cross link to the page it names, in this language', async () => {
    const page = await (
      await markdownPageNavigator()
    )('/de/docs/getting-started');

    expect(
      page.querySelector('lg-markdown a[href="/de/docs/custom-components"]')
    ).not.toBeNull();
    expect(page.querySelector('lg-markdown a[href^="docs:"]')).toBeNull();
  });

  /**
   * The rewrite leaves the renderer looking at a link with no scheme, which it
   * would otherwise open in a new tab. Following one has to stay a navigation.
   */
  it('follows a cross link in the app rather than a new tab', async () => {
    const render = await markdownPageNavigator();
    const page = await render('/en/docs/getting-started');
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const router = TestBed.inject(Router);
    // Armed before the click: the guard awaits an import, so the navigation
    // outlives any fixed number of turns.
    const navigated = firstValueFrom(
      router.events.pipe(filter((event) => event instanceof NavigationEnd))
    );

    page
      .querySelector('lg-markdown a[href="/en/docs/custom-components"]')!
      .dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
    await navigated;

    expect(open).not.toHaveBeenCalled();
    expect(router.url).toBe('/en/docs/custom-components');
  });

  it('points a screenshot at the file the build emitted', async () => {
    const page = await (
      await markdownPageNavigator()
    )('/en/docs/getting-started');
    const image = page.querySelector('lg-markdown img');

    expect(image?.getAttribute('src')).toMatch(/intro-banner-\w+\.png$/);
  });

  it('lists every page on the index', async () => {
    const page = await (await markdownPageNavigator())('/en/docs');

    expect(page.querySelector('h1')?.textContent).toContain('Documentation');
    expect(page.querySelectorAll('a[href^="/en/docs/"]').length).toBe(
      DOC_PAGE_IDS.length
    );
  });

  /** A page id that names nothing is not a page, so it is the 404. */
  it('404s on an id that names no page', async () => {
    const page = await (await markdownPageNavigator())('/en/docs/nonsense');

    expect(page.textContent).toContain('Page not found');
  });
});
