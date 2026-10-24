/** What this browser's canvas can encode as WebP. */
export interface WebpSupport {
  /** `toBlob`/`toDataURL` produce WebP at all, rather than falling back to PNG. */
  readonly encode: boolean;
  /** The encoder writes lossless WebP at {@link WEBP_LOSSLESS_QUALITY}. */
  readonly lossless: boolean;
}

/**
 * The quality argument that asks a canvas for lossless WebP. Chromium encodes
 * lossless at exactly 1 and lossy below it; the canvas API has no other way to
 * ask, so whether a browser honours it is what `WebpSupportService` probes.
 */
export const WEBP_LOSSLESS_QUALITY = 1;

export const NO_WEBP_SUPPORT: WebpSupport = { encode: false, lossless: false };

/**
 * Reads a probe's data URL. The image data is the `VP8L` chunk for lossless
 * and `VP8 ` for lossy, either first in the file or after a `VP8X` header and
 * whatever it announces — Chromium puts a colour profile there — so the chunks
 * are walked rather than one offset read.
 */
export function webpSupportOf(dataUrl: string): WebpSupport {
  const prefix = 'data:image/webp;base64,';
  if (!dataUrl.startsWith(prefix)) return NO_WEBP_SUPPORT;

  let bytes: string;
  try {
    bytes = atob(dataUrl.slice(prefix.length));
  } catch {
    return NO_WEBP_SUPPORT;
  }
  if (bytes.slice(0, 4) !== 'RIFF' || bytes.slice(8, 12) !== 'WEBP') {
    return NO_WEBP_SUPPORT;
  }

  // RIFF chunks: a four-character code, a little-endian size, the payload,
  // and a pad byte after an odd-sized one.
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const code = bytes.slice(offset, offset + 4);
    if (code === 'VP8L') return { encode: true, lossless: true };
    if (code === 'VP8 ') return { encode: true, lossless: false };
    const size =
      (bytes.charCodeAt(offset + 4) |
        (bytes.charCodeAt(offset + 5) << 8) |
        (bytes.charCodeAt(offset + 6) << 16) |
        (bytes.charCodeAt(offset + 7) << 24)) >>>
      0;
    offset += 8 + size + (size & 1);
  }
  // A WebP with no image chunk is a broken encoder, not a lossless one.
  return { encode: true, lossless: false };
}
