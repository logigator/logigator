import { beforeEach, describe, expect, it } from 'vitest';
import { AVAILABLE_LANGUAGES } from '@logigator/core';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { markdownPageNavigator } from '../../../testing/markdown-page-harness';
import { loadChangelog } from './changelog-content';

describe('the changelog page', () => {
  beforeEach(() => {
    configureTestBed();
  });

  it('gives every release the heading its feed entry links to', async () => {
    const page = await (await markdownPageNavigator())('/en/changelog');
    const { releases } = await loadChangelog('en');

    expect(
      releases.map((release) =>
        page.querySelector(`h2[id="${release.version}"]`)
      )
    ).not.toContain(null);
    expect(page.querySelectorAll('lg-markdown').length).toBe(releases.length);
    // The notes start below the release heading, so the page keeps one h1 and
    // one h2 per release above them.
    expect(page.querySelector('lg-markdown h1, lg-markdown h2')).toBeNull();
  });

  it('writes a release date out in the language it renders in', async () => {
    const render = await markdownPageNavigator();

    expect((await render('/en/changelog')).textContent).toContain(
      'August 6, 2026'
    );
    expect((await render('/de/changelog')).textContent).toContain(
      '6. August 2026'
    );
  });

  /**
   * The releases are one history in four translations: a version or a date
   * edited in one file alone is a page that disagrees with itself and a feed
   * whose entries do not line up with the other languages'.
   */
  it.each(AVAILABLE_LANGUAGES.map(({ id }) => id))(
    'lists the same releases in %s as in English',
    async (lang) => {
      const english = await loadChangelog('en');
      const translated = await loadChangelog(lang);

      expect(
        translated.releases.map(({ version, date }) => ({ version, date }))
      ).toEqual(
        english.releases.map(({ version, date }) => ({ version, date }))
      );
    }
  );
});
