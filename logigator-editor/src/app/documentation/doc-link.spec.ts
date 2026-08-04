import { describe, expect, it } from 'vitest';
import { parseDocsLink } from './doc-link';

describe('parseDocsLink', () => {
  it('parses a docs: link into its page', () => {
    expect(parseDocsLink('docs:wires-and-connections')).toEqual({
      page: 'wires-and-connections'
    });
  });

  it('splits a heading anchor off a page link', () => {
    expect(parseDocsLink('docs:simulation#speed-modes')).toEqual({
      page: 'simulation',
      anchor: 'speed-modes'
    });
  });

  it('returns null for hrefs without a docs: page', () => {
    expect(parseDocsLink('')).toBeNull();
    expect(parseDocsLink('#junctions')).toBeNull();
    expect(parseDocsLink('https://logigator.com/features')).toBeNull();
    expect(parseDocsLink('mailto:hi@logigator.com')).toBeNull();
    expect(parseDocsLink('docs:')).toBeNull();
    expect(parseDocsLink('docs:#speed-modes')).toBeNull();
  });
});
