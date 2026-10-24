import { describe, expect, it } from 'vitest';
import type { CircuitPreview, ImageVariant } from '@logigator/contract';
import { crawlerImageUrl, crawlerPreviewUrl } from './crawler-image';

function ladder(slot: string): ImageVariant[] {
  return [
    {
      url: `/files/preview/ab/x/${slot}-256.webp`,
      width: 256,
      height: 256,
      format: 'webp'
    },
    {
      url: `/files/preview/ab/x/${slot}-256.png`,
      width: 256,
      height: 256,
      format: 'png'
    },
    {
      url: `/files/preview/ab/x/${slot}-1024.webp`,
      width: 1024,
      height: 1024,
      format: 'webp'
    },
    {
      url: `/files/preview/ab/x/${slot}-1024.png`,
      width: 1024,
      height: 1024,
      format: 'png'
    }
  ];
}

describe('crawlerImageUrl', () => {
  it('takes the widest rung in the format asked for', () => {
    // Whatever crops or scales it is not ours, so the widest is the one to
    // hand over; and the encoding the browsers prefer is not the one every
    // consumer reads.
    expect(crawlerImageUrl(ladder('light'), 'png')).toBe(
      '/files/preview/ab/x/light-1024.png'
    );
  });

  it('falls back to the widest rung there is rather than to nothing', () => {
    const webpOnly = ladder('light').filter(
      (variant) => variant.format === 'webp'
    );
    expect(crawlerImageUrl(webpOnly, 'png')).toBe(
      '/files/preview/ab/x/light-1024.webp'
    );
  });

  it('answers nothing for an asset that does not exist', () => {
    expect(crawlerImageUrl(null, 'png')).toBeNull();
    expect(crawlerImageUrl([], 'png')).toBeNull();
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
      '/files/preview/ab/x/light-1024.png'
    );
  });

  it('answers nothing for a circuit that was never saved from the editor', () => {
    expect(crawlerPreviewUrl(null)).toBeNull();
  });
});
