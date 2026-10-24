import { describe, expect, it } from 'vitest';
import { webpSupportOf } from './webp-support';

/** A RIFF chunk: four-character code, little-endian size, payload, pad byte. */
function chunk(code: string, size: number): string {
  const header =
    code +
    String.fromCharCode(
      size & 0xff,
      (size >> 8) & 0xff,
      (size >> 16) & 0xff,
      (size >> 24) & 0xff
    );
  return header + '\0'.repeat(size + (size & 1));
}

function webpDataUrl(...chunks: string[]): string {
  const body = 'WEBP' + chunks.join('');
  const size = body.length;
  const riff =
    'RIFF' +
    String.fromCharCode(
      size & 0xff,
      (size >> 8) & 0xff,
      (size >> 16) & 0xff,
      (size >> 24) & 0xff
    ) +
    body;
  return `data:image/webp;base64,${btoa(riff)}`;
}

describe('webpSupportOf', () => {
  // Chromium's layout: an extended header and a colour profile before the
  // image data, with odd sizes to make the walk honour padding.
  it('finds lossless image data behind an extended header', () => {
    expect(
      webpSupportOf(
        webpDataUrl(chunk('VP8X', 10), chunk('ICCP', 455), chunk('VP8L', 13))
      )
    ).toEqual({ encode: true, lossless: true });
  });

  it('reports a lossy encoder, alpha chunk and all', () => {
    expect(
      webpSupportOf(
        webpDataUrl(
          chunk('VP8X', 10),
          chunk('ICCP', 455),
          chunk('ALPH', 5),
          chunk('VP8 ', 26)
        )
      )
    ).toEqual({ encode: true, lossless: false });
  });

  it('reads a simple-format file, image data first', () => {
    expect(webpSupportOf(webpDataUrl(chunk('VP8L', 13)))).toEqual({
      encode: true,
      lossless: true
    });
  });

  // What a browser without a WebP encoder answers.
  it('reports no WebP for a PNG fallback', () => {
    expect(
      webpSupportOf(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg=='
      )
    ).toEqual({ encode: false, lossless: false });
  });
});
