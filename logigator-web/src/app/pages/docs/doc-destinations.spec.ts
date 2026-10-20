import { describe, expect, it } from 'vitest';
import { docImages } from '@logigator/docs';
import { resolveMarkdownUrls } from '@logigator/ui/internal/markdown-urls';
import { docDestinations } from './doc-destinations';

describe('docDestinations', () => {
  const [authored, picture] = Object.entries(docImages('de'))[0];

  /** Without the size the page cannot reserve the box, and anchors land short. */
  it('keeps a picture’s size beside the URL it is written as', () => {
    const destinations = docDestinations(
      'de',
      (page) => `/de/docs/${page}`,
      (url) => `/${url}`
    );

    expect(destinations[authored]).toEqual({
      url: `/${picture.url}`,
      width: picture.width,
      height: picture.height
    });
    expect(resolveMarkdownUrls(`![alt](${authored})`, destinations)).toBe(
      `![alt](/${picture.url})`
    );
  });
});
