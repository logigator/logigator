import sharp from 'sharp';

/**
 * Encodes a captured screenshot as an indexed PNG. Chromium returns truecolour
 * but the editor draws from a flat palette, so quantizing at quality 100 keeps
 * every colour the picture uses and only changes how it is stored.
 * libimagequant is deterministic: an unchanged shot re-encodes to identical
 * bytes.
 */
export function encodePng(buffer) {
  return sharp(buffer)
    .png({ palette: true, quality: 100, effort: 10 })
    .toBuffer();
}
