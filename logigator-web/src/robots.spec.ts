import { describe, expect, it } from 'vitest';
import { renderRobotsTxt } from './robots';

const FILE = renderRobotsTxt('https://logigator.com/sitemap.xml');

describe('renderRobotsTxt', () => {
  it('names the sitemap it was given', () => {
    expect(FILE).toContain('Sitemap: https://logigator.com/sitemap.xml');
  });

  it('is still a valid file without one', () => {
    // A `5xx` here is read as "crawl nothing", so a host the deployment will
    // not vouch for costs the line rather than the answer.
    const anonymous = renderRobotsTxt(null);
    expect(anonymous).not.toContain('Sitemap:');
    expect(anonymous).toContain('User-agent: *');
    expect(anonymous).toContain('Disallow: /share/');
  });

  it('closes the share link, which is a capability rather than a page', () => {
    expect(FILE).toContain('Disallow: /share/');
    expect(FILE).toContain('Disallow: /editor/share/');
  });

  it('leaves the language-prefixed share page crawlable, to be read as noindex', () => {
    // A `/*/share/` rule would look like the careful thing to add and would
    // break two things at once: the crawler would never fetch the page that
    // says "noindex, follow", and the rule also matches the share card under
    // `/api/share/`, which the `Allow:` above it exists to keep reachable. The
    // page is kept out of indexes by its own head instead.
    expect(FILE).not.toContain('Disallow: /*/share/');
  });

  it('leaves the community section open, which the tag is what keeps in order', () => {
    // The page a link somebody was handed lands on is under /community/, and
    // answers `noindex` wherever the document is not public. Disallowing the
    // section would be the one change that breaks the mechanism: a crawler is
    // never told to skip what it is forbidden to fetch, so those pages would
    // be listed by URL alone with the tag never read.
    expect(FILE).not.toContain('Disallow: /community');
  });

  it('allows the share card ahead of the rule that would hide it', () => {
    // Longest-match resolution makes the order irrelevant to Google; a
    // first-match reader is why it is written this way round. Both segments
    // the route takes a variable in are wildcards, so one line covers both
    // tables — see `SHARE_CARD_PATH_PATTERN`.
    expect(FILE).toContain('Allow: /api/share/*/*/card.png');
    expect(FILE.indexOf('Allow: /api/share/*/*/card.png')).toBeLessThan(
      FILE.indexOf('Disallow: /api/')
    );
  });

  it('closes the one-shot token routes under every language prefix', () => {
    expect(FILE).toContain('Disallow: /*/verify-email/');
    expect(FILE).toContain('Disallow: /*/reset-password');
  });

  it('names no crawler', () => {
    // Allowing by omission is the decision. A roster of bot names would be
    // stale the month a new one ships, and reads as policy where omission reads
    // as what it is.
    expect(FILE.match(/^User-agent:.*$/gm)).toEqual(['User-agent: *']);
    for (const bot of [
      'GPTBot',
      'ClaudeBot',
      'CCBot',
      'PerplexityBot',
      'Google-Extended'
    ]) {
      expect(FILE).not.toContain(bot);
    }
  });
});
