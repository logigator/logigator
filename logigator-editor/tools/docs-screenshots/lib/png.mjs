import fs from 'node:fs/promises';
import sharp from 'sharp';

/**
 * Writes a captured screenshot as an indexed PNG.
 *
 * Chromium hands screenshots back as truecolour, while the editor draws its
 * chrome and its board from a flat palette — a full-window shot lands around
 * 250 distinct colours. Quantizing at quality 100 therefore keeps every colour
 * the picture actually uses and only changes how it is stored. libimagequant
 * is deterministic, so an unchanged shot re-captures to identical bytes and
 * leaves the tracked image alone.
 */
export async function writePng(file, buffer) {
  const png = await sharp(buffer)
    .png({ palette: true, quality: 100, effort: 10 })
    .toBuffer();
  await fs.writeFile(file, png);
}
