import { PNG } from 'pngjs';
import gifenc from 'gifenc';

// gifenc ships CommonJS, so its exports arrive on the default import.
const { GIFEncoder, quantize, applyPalette } = gifenc;

/** How long each frame is held, in ms. */
export const DEFAULT_FRAME_DELAY = 1200;

/**
 * Encodes captured frames into an animated GIF. The animated doc images are
 * step-throughs — the same picture with a few things lit differently — which
 * the encoding leans on twice: one palette quantized across every frame serves
 * as the global colour table, and every frame after the first keeps only the
 * pixels whose colour index changed.
 */
export async function encodeGif(frames, delay = DEFAULT_FRAME_DELAY) {
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

  // Quantized over every frame at once, so a colour means the same index in
  // all of them. Only 255 slots, the 256th claimed for transparency
  // afterwards, so no pixel can land on the index meaning "unchanged".
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

  // Backwards, so each frame is compared against a predecessor that is not
  // punched through yet.
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
      // Only on the first frame, which makes it the global colour table.
      ...(index === 0 ? { palette } : {}),
      transparent: index > 0,
      transparentIndex,
      // "Do not dispose": the frame stays on screen as the base the next is
      // punched through onto. The first is opaque, so a loop starts clean.
      dispose: 1
    });
  });
  encoder.finish();

  return Buffer.from(encoder.bytes());
}
