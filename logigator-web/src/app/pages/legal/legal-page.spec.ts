import { beforeEach, describe, expect, it } from 'vitest';
import { RouterTestingHarness } from '@angular/router/testing';
import { marked } from 'marked';
import { headingSlug } from '@logigator/ui';
import { AVAILABLE_LANGUAGES } from '@logigator/core';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { LegalDocumentKind, loadLegalDocument } from './legal-document';

const KINDS: LegalDocumentKind[] = ['imprint', 'privacy-policy'];

describe('the legal pages', () => {
  beforeEach(() => {
    configureTestBed();
  });

  /**
   * Navigates the one harness a test may create, and returns the rendered
   * page. Two navigations is how a language switch reaches this page.
   */
  async function navigator(): Promise<(url: string) => Promise<HTMLElement>> {
    const harness = await RouterTestingHarness.create();
    return async (url) => {
      await harness.navigateByUrl(url);
      // ngx-markdown assigns the parsed innerHTML asynchronously.
      await harness.fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));
      harness.detectChanges();
      return harness.routeNativeElement!;
    };
  }

  it('renders the document its route names, whole', async () => {
    const page = await (await navigator())('/en/imprint');

    expect(page.querySelector('h1')?.textContent).toContain('Imprint');
    // The body's own headings start at h2: the page's h1 is its title, and two
    // would leave the document with no single name.
    expect(page.querySelector('lg-markdown h1')).toBeNull();
    expect(page.textContent).toContain('Liability for links on this website');
    expect(
      page.querySelector('a[href="mailto:business@logigator.com"]')
    ).not.toBeNull();
  });

  it('follows a language switch, which is a navigation to the same page', async () => {
    const render = await navigator();
    const english = await render('/en/imprint');
    expect(english.textContent).toContain('Liability for contents');

    const german = await render('/de/imprint');
    expect(german.textContent).toContain('Haftung für Inhalte dieser Webseite');
    expect(german.textContent).not.toContain('Liability for contents');
  });

  it('renders the privacy policy with its table of contents', async () => {
    const page = await (await navigator())('/en/privacy-policy');

    expect(page.querySelector('h1')?.textContent).toContain('Privacy Policy');
    expect(page.textContent).toContain('Table of contents');
    expect(page.querySelectorAll('lg-markdown a[href^="#"]').length).toBe(11);
  });

  /**
   * The renderer emits no heading ids: a `#fragment` resolves against the
   * slug of a heading's own text. A heading renamed in a translation without
   * its entry in that document's table of contents is a link to nowhere, and
   * nothing else would catch it.
   */
  it.each(
    KINDS.flatMap((kind) =>
      AVAILABLE_LANGUAGES.map(({ id }) => ({ kind, lang: id }))
    )
  )('has resolvable in-page links in $kind/$lang', async ({ kind, lang }) => {
    const html = await marked.parse(await loadLegalDocument(kind, lang));
    const body = document.createElement('div');
    body.innerHTML = html;

    const slugs = [...body.querySelectorAll('h1, h2, h3, h4')].map((heading) =>
      headingSlug(heading.textContent ?? '')
    );
    const targets = [...body.querySelectorAll('a[href^="#"]')].map((anchor) =>
      decodeURIComponent(anchor.getAttribute('href')!.slice(1))
    );

    expect(targets.filter((target) => !slugs.includes(target))).toEqual([]);
  });
});
