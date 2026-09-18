import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { DocsSearchService } from './docs-search.service';
import { configureTestBed } from '../../../testing/configure-test-bed';

/** The renderer assigns its content asynchronously; a CI runner is not this one. */
const WAIT = { timeout: 5000 };

describe('documentation search', () => {
  const scrollIntoView = Element.prototype.scrollIntoView;

  beforeEach(() => {
    configureTestBed();
  });

  afterEach(() => {
    // A plain assignment, so `restoreAllMocks` does not put it back.
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  /**
   * Navigates, then settles: the index is built from eleven dynamic imports,
   * so a result appears some turns after the navigation resolves.
   */
  async function navigator(): Promise<
    (url: string) => Promise<() => HTMLElement>
  > {
    const harness = await RouterTestingHarness.create();
    return async (url) => {
      await harness.navigateByUrl(url);
      return () => {
        harness.detectChanges();
        return harness.routeNativeElement!;
      };
    };
  }

  /**
   * A guard answers the query before the route activates, so the render — the
   * server's included — carries the results rather than the page's contents
   * list for a moment first. No wait here is the assertion.
   */
  it('answers the query the URL names, as links into the pages', async () => {
    const page = await (await navigator())('/en/docs?q=run%20controls');

    // The query rides on the link, so the page it opens can mark the words
    // that led there — and still does after a reload or a paste.
    expect(
      page().querySelector(
        'a[href="/en/docs/simulation?q=run%20controls#the-run-controls"]'
      )
    ).not.toBeNull();
    expect(page().querySelector('.ph-file-text')).toBeNull();
  });

  /**
   * The anchor is a heading slug the renderer resolves, so a result that named
   * a heading the page does not have would scroll nowhere. Every one of them
   * has to be a heading in the page it points at.
   */
  it('marks the words it matched, in the heading and in the quote', async () => {
    const page = await (await navigator())('/en/docs?q=simulation%20speed');

    const marks = [...page().querySelectorAll('web-docs-search-results mark')];
    expect(marks.length).toBeGreaterThan(0);
    expect(
      marks.every((mark) =>
        ['simulation', 'speed'].includes((mark.textContent ?? '').toLowerCase())
      )
    ).toBe(true);
  });

  /**
   * The parts a match splits a string into are rendered side by side, so any
   * whitespace the template leaves between them lands inside the word: a
   * partial match reads as two words rather than one highlighted stem.
   */
  it('marks part of a word without breaking the word up', async () => {
    const page = await (await navigator())('/en/docs?q=simul');

    const mark = page().querySelector('web-docs-search-results mark');
    expect(mark?.textContent?.toLowerCase()).toBe('simul');
    // The stem and its remainder are separate elements; anything between them
    // reads as a word break.
    expect(mark?.parentElement?.textContent?.toLowerCase()).toContain(
      'simulation'
    );
  });

  /**
   * The URL follows the field debounced, so nothing may wait for it: the query
   * the field holds is answered as it is typed. An effect that carried the URL
   * into the field and also depended on the field would put the URL's older
   * value back on every keystroke, which reads as a field that lags.
   */
  it('answers a keystroke without waiting for the URL to catch up', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/en/docs');

    const input = harness.routeNativeElement!.querySelector('input')!;
    input.value = 'cloud';
    input.dispatchEvent(new Event('input'));
    harness.detectChanges();

    expect(TestBed.inject(DocsSearchService).query()).toBe('cloud');
    expect(TestBed.inject(Router).url).toBe('/en/docs');
  });

  /**
   * A hit can match on the page's name alone — every section carries it — so
   * the name is marked like the rest; without that, a row whose section says
   * nothing of the query shows no highlight and reads as a stray result.
   */
  it('marks the page name, so every row shows why it is a result', async () => {
    const page = await (await navigator())('/en/docs?q=shortcuts');

    const rows = [...page().querySelectorAll('web-docs-search-results li')];
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.every((row) => row.querySelector('mark'))).toBe(true);
  });

  it('says so when nothing matches, rather than showing the contents', async () => {
    const page = await (await navigator())('/en/docs?q=oscilloscope');

    expect(page().textContent).toContain('Nothing matches');
    expect(page().querySelector('a[href="/en/docs/cloud"]')).toBeNull();
  });

  it('is the contents list again once the query is gone', async () => {
    const render = await navigator();
    const searched = await render('/en/docs?q=cloud');
    expect(searched().querySelector('web-docs-search-results')).not.toBeNull();

    const plain = await render('/en/docs');
    expect(plain().querySelector('web-docs-search-results')).toBeNull();
    expect(plain().querySelector('a[href="/en/docs/cloud"]')).not.toBeNull();
  });

  /**
   * Without script the submit is the form's own: a GET to the index, which
   * resolves the query. Left to the click handler alone it would land on
   * whatever page the field is beside, carrying a parameter that page ignores.
   */
  it('submits to the index even with no script to route it', async () => {
    const page = await (await navigator())('/en/docs/simulation');
    const form = page().querySelector('form[role="search"]')!;

    expect(form.getAttribute('action')).toBe('/en/docs');
    expect(form.getAttribute('method')).toBe('get');
    expect(form.querySelector('input')?.getAttribute('name')).toBe('q');
  });

  /**
   * The renderer emits no heading ids, so the router's own anchor scrolling
   * finds nothing; a fragment resolves against the slug of a heading's own
   * text. Without this a shared deep link — and every search result — lands at
   * the top of the page.
   */
  it('scrolls a doc page to the heading its fragment names', async () => {
    const scrolls = vi.fn();
    Element.prototype.scrollIntoView = scrolls;

    const page = await (
      await navigator()
    )('/en/docs/simulation#the-run-controls');

    await vi.waitFor(() => {
      page();
      expect(scrolls).toHaveBeenCalled();
      const scrolled = scrolls.mock.instances[0] as HTMLElement;
      expect(scrolled.textContent).toBe('The run controls');
    }, WAIT);
  });
});
