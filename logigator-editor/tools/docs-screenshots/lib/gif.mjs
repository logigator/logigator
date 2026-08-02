import fs from 'node:fs/promises';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';

// gifenc ships CommonJS, so its exports arrive on the default import.
const { GIFEncoder, quantize, applyPalette } = gifenc;

/** How long each frame is held, in ms. */
export const DEFAULT_FRAME_DELAY = 1200;

/**
 * Encodes captured frames into an animated GIF.
 *
 * The two animated doc images are step-throughs — a simulation before and after
 * a tick, a ROM inspector before and after the address changes — so each frame
 * is an ordinary shot of a deterministic state and this only has to stitch
 * them. Frames are quantized independently; at 256 colours per frame the
 * editor's flat palette comes through exactly.
 */
export async function writeGif(file, frames, delay = DEFAULT_FRAME_DELAY) {
  if (frames.length === 0) throw new Error('a gif needs at least one frame');
  const encoder = GIFEncoder();
  let size = null;

  for (const buffer of frames) {
    const { data, width, height } = PNG.sync.read(buffer);
    size ??= { width, height };
    if (width !== size.width || height !== size.height) {
      throw new Error(
        `frame sizes differ (${width}×${height} vs ` +
          `${size.width}×${size.height}) — every frame must use the same clip`
      );
    }
    const palette = quantize(data, 256, { format: 'rgb565' });
    encoder.writeFrame(applyPalette(data, palette, 'rgb565'), width, height, {
      palette,
      delay
    });
  }

  encoder.finish();
  await fs.writeFile(file, encoder.bytes());
}
