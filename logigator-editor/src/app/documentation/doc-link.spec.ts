import { describe, expect, it } from 'vitest';
import { classifyDocLink, headingSlug } from './doc-link';

describe('classifyDocLink', () => {
  it('classifies docs: links as page jumps', () => {
    expect(classifyDocLink('docs:wires-and-connections')).toEqual({
      kind: 'page',
      page: 'wires-and-connections'
    });
  });

  it('splits a heading anchor off a page link', () => {
    expect(classifyDocLink('docs:simulation#speed-modes')).toEqual({
      kind: 'page',
      page: 'simulation',
      anchor: 'speed-modes'
    });
  });

  it('strips the unsafe: prefix the HTML sanitizer adds to docs: hrefs', () => {
    expect(classifyDocLink('unsafe:docs:cloud')).toEqual({
      kind: 'page',
      page: 'cloud'
    });
  });

  it('classifies fragment links as in-page anchors', () => {
    expect(classifyDocLink('#junctions')).toEqual({
      kind: 'anchor',
      anchor: 'junctions'
    });
  });

  it('classifies absolute http(s) links as external', () => {
    expect(classifyDocLink('https://logigator.com/features')).toEqual({
      kind: 'external',
      url: 'https://logigator.com/features'
    });
  });

  it('has no doc semantics for empty, relative or other-scheme hrefs', () => {
    expect(classifyDocLink(null).kind).toBe('none');
    expect(classifyDocLink('').kind).toBe('none');
    expect(classifyDocLink('./image.png').kind).toBe('none');
    expect(classifyDocLink('mailto:hi@logigator.com').kind).toBe('none');
    expect(classifyDocLink('docs:').kind).toBe('none');
  });
});

describe('headingSlug', () => {
  it('lowercases and joins words with dashes', () => {
    expect(headingSlug('Speed Modes')).toBe('speed-modes');
  });

  it('collapses punctuation runs and trims edge dashes', () => {
    expect(headingSlug('  Wires & Connections! ')).toBe('wires-connections');
  });

  it('keeps non-latin letters and digits', () => {
    expect(headingSlug('Größe 2×4')).toBe('größe-2-4');
  });
});
