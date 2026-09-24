import sharp from 'sharp';

/** How long each frame of a step-through is held, in ms. */
export const DEFAULT_FRAME_DELAY = 1200;

/**
 * Encodes what a shot returned: its frames, one for a still or several for a
 * step-through, at `delay` ms each when there are several.
 *
 * This is the whole of the tool's output format, so it is the only encoder in
 * it — which frame count a shot has is a fact about the shot, not about what
 * the target is for.
 *
 * Lossless, because the editor draws anti-aliased text and hairlines over flat
 * ground, which is the case lossy WebP handles worst: measured on the tracked
 * captures, `quality: 82` came out at or *above* the quantized GIF it replaced,
 * while lossless is a third of it. libwebp is deterministic, so an unchanged
 * capture re-encodes to identical bytes and leaves the tracked file alone.
 */
export function encodeCapture(frames, delay = DEFAULT_FRAME_DELAY) {
  return frames.length === 1
    ? encodeStill(frames[0])
    : encodeAnimation(frames, delay);
}

/** Encodes one captured frame. */
function encodeStill(buffer) {
  return sharp(buffer).webp({ lossless: true }).toBuffer();
}

/**
 * Encodes captured frames as one animated WebP. The animated images are
 * step-throughs — two settled states of one scene, a switch or a tick apart —
 * so the frames are whole pictures rather than a delta chain, and every one has
 * to come from the same clip.
 *
 * `delay` is one value per frame to sharp, and a lone number reaches only the
 * first: the rest fall back to libwebp's 100 ms and the animation reads as one
 * held frame followed by a flicker. The step-throughs hold every frame alike,
 * so the one delay is repeated rather than the callers each assembling a list.
 */
async function encodeAnimation(frames, delay) {
  await assertSameSize(frames);

  return sharp(frames, { join: { animated: true } })
    .webp({ lossless: true, delay: frames.map(() => delay) })
    .toBuffer();
}

/**
 * Frames of different sizes are joined without complaint — the result is one
 * animated file whose frames disagree — so the sizes are checked here, with the
 * sizes in the message.
 */
async function assertSameSize(frames) {
  const sizes = await Promise.all(
    frames.map(async (frame) => {
      const { width, height } = await sharp(frame).metadata();
      return { width, height };
    })
  );
  const [first] = sizes;
  sizes.forEach((size, index) => {
    if (size.width !== first.width || size.height !== first.height) {
      throw new Error(
        `frame ${index + 1} is ${size.width}×${size.height}, the first is ` +
          `${first.width}×${first.height} — every frame must use the same clip`
      );
    }
  });
}
