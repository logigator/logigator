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
 * The animated doc images are step-throughs — a simulation before and after a
 * tick, a ROM inspector before and after the address changes — so each frame is
 * an ordinary shot of a deterministic state and this only has to stitch them.
 *
 * The frames of a step-through are the same picture with a few things lit
 * differently, which the encoding leans on twice. One palette is quantized
 * across all of them and written as the global colour table, so a frame carries
 * no table of its own; and every frame after the first keeps only the pixels
 * whose colour index changed, writing the rest as a transparent index that
 * leaves what is already on screen in place.
 */
export async function writeGif(file, frames, delay = DEFAULT_FRAME_DELAY) {
  if (frames.length === 0) throw new Error('a gif needs at least one frame');

  const decoded = frames.map((buffer) => PNG.sync.read(buffer));
  const { width, height } = decoded[0];
  for (const frame of decoded) {
    if (frame.width !== width || frame.height !== height) {
      throw new Error(
        `frame sizes differ (${frame.width}×${frame.height} vs ` +
          `${width}×${height}) — every frame must use the same clip`
      );
    }
  }

  // Quantized over every frame at once, so a colour means the same index in all
  // of them — what makes both the shared table and the diff below possible. The
  // 256th slot is left out here and claimed for transparency afterwards, so no
  // pixel can quantize onto the index that means "unchanged".
  const pixels = new Uint8Array(decoded.length * decoded[0].data.length);
  decoded.forEach((frame, index) => {
    pixels.set(frame.data, index * frame.data.length);
  });
  const palette = quantize(pixels, 255, { format: 'rgb565' });
  const transparentIndex = palette.length;
  const indexed = decoded.map((frame) =>
    applyPalette(frame.data, palette, 'rgb565')
  );
  palette.push([0, 0, 0]);

  // Backwards, so each frame is compared against a predecessor that has not
  // been punched through yet.
  for (let index = indexed.length - 1; index > 0; index--) {
    const frame = indexed[index];
    const previous = indexed[index - 1];
    for (let pixel = 0; pixel < frame.length; pixel++) {
      if (frame[pixel] === previous[pixel]) frame[pixel] = transparentIndex;
    }
  }

  const encoder = GIFEncoder();
  indexed.forEach((frame, index) => {
    encoder.writeFrame(frame, width, height, {
      delay,
      // Only the first frame carries the palette, which makes it the global
      // colour table every later frame reads from.
      ...(index === 0 ? { palette } : {}),
      transparent: index > 0,
      transparentIndex,
      // "Do not dispose": the frame stays on screen as the base the next one is
      // punched through onto. The first frame is fully opaque, so a looping gif
      // starts clean again.
      dispose: 1
    });
  });
  encoder.finish();

  await fs.writeFile(file, encoder.bytes());
}
