import { describe, expect, it } from 'vitest';
import { resolveMarkdownUrls } from './markdown';

describe('resolveMarkdownUrls', () => {
  const urls = {
    'images/intro-banner.png': 'media/intro-banner-H4SH.png',
    'files/manual.pdf': 'media/manual-H4SH.pdf'
  };

  it('replaces mapped image and link destinations, preserving alt and label', () => {
    const md =
      '![The editor at a glance](images/intro-banner.png)\n' +
      'Download the [manual](files/manual.pdf).';
    expect(resolveMarkdownUrls(md, urls)).toBe(
      '![The editor at a glance](media/intro-banner-H4SH.png)\n' +
        'Download the [manual](media/manual-H4SH.pdf).'
    );
  });

  it('keeps unmapped, empty and external destinations untouched', () => {
    const md =
      '![placeholder]()\n' +
      '![missing](images/not-registered.png)\n' +
      '[site](https://logigator.com)';
    expect(resolveMarkdownUrls(md, urls)).toBe(md);
  });

  it('carries a link title over to the mapped destination', () => {
    expect(
      resolveMarkdownUrls('![alt](images/intro-banner.png "The editor")', urls)
    ).toBe('![alt](media/intro-banner-H4SH.png "The editor")');
  });

  it('matches destinations verbatim, not inherited object properties', () => {
    expect(resolveMarkdownUrls('[a](constructor)', urls)).toBe(
      '[a](constructor)'
    );
  });
});
