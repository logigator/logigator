import { describe, expect, it } from 'vitest';
import type { CircuitPreview, ImageVariant } from '@logigator/contract';
import { crawlerImageUrl, crawlerPreviewUrl } from './crawler-image';

function ladder(slot: string): ImageVariant[] {
  return [512, 1024].map((size) => ({
    url: `/files/preview/ab/x/${slot}-${size}.webp`,
    width: size,
    height: size,
    format: 'webp'
  }));
}

describe('crawlerImageUrl', () => {
  it('takes the widest rung', () => {
    // Whatever crops or scales it is not ours, so the widest is the one to
    // hand over.
    expect(crawlerImageUrl(ladder('light').reverse())).toBe(
      '/files/preview/ab/x/light-1024.webp'
    );
  });

  it('answers nothing for an asset that does not exist', () => {
    expect(crawlerImageUrl(null)).toBeNull();
    expect(crawlerImageUrl([])).toBeNull();
  });
});

describe('crawlerPreviewUrl', () => {
  it('picks the light render, whatever the reader’s scheme', () => {
    // A preview is line art on a transparent ground: the dark render's pale
    // wires disappear wherever the consumer composites onto white.
    const preview: CircuitPreview = {
      light: ladder('light'),
      dark: ladder('dark')
    };
    expect(crawlerPreviewUrl(preview)).toBe(
      '/files/preview/ab/x/light-1024.webp'
    );
  });

  it('answers nothing for a circuit that was never saved from the editor', () => {
    expect(crawlerPreviewUrl(null)).toBeNull();
  });
});
