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
export function encodeCapture(
  frames: readonly Buffer[],
  delay: number = DEFAULT_FRAME_DELAY,
  keyframes?: number
): Promise<Buffer> {
  if (frames.length === 1) return encodeStill(frames[0]);
  return keyframes
    ? encodeKeyframed(frames, delay, keyframes)
    : encodeAnimation(frames, delay);
}

/** Encodes one captured frame. */
function encodeStill(buffer: Buffer): Promise<Buffer> {
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
async function encodeAnimation(
  frames: readonly Buffer[],
  delay: number
): Promise<Buffer> {
  await assertSameSize(frames);

  return sharp([...frames], { join: { animated: true } })
    .webp({ lossless: true, delay: frames.map(() => delay) })
    .toBuffer();
}

/**
 * Frames of different sizes are joined without complaint — the result is one
 * animated file whose frames disagree — so the sizes are checked here, with the
 * sizes in the message.
 */
async function assertSameSize(frames: readonly Buffer[]): Promise<void> {
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

/**
 * Encodes captured frames as an animated WebP that stores every `interval`th
 * frame whole. The frames between are each the rectangle that changed since
 * the one before, its unchanged pixels transparent and blended over it — the
 * delta libwebp writes too — so each depends on the one before it, back to the
 * last whole frame.
 *
 * That chain is what a browser decodes to show a frame it did not just show:
 * one coming back from the background jumps to where the loop is by the clock,
 * and without whole frames along the way it decodes every frame from the
 * first. Neither sharp nor libvips exposes libwebp's keyframe interval, so the
 * container is written here, around frames sharp encodes one at a time.
 *
 * A long loop asks for this; a step-through does not, and keeps the encoder
 * that has always written it, so its tracked bytes stay the same.
 */
async function encodeKeyframed(
  frames: readonly Buffer[],
  delay: number,
  interval: number
): Promise<Buffer> {
  await assertSameSize(frames);
  const pictures = await Promise.all(
    frames.map((frame) =>
      sharp(frame).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    )
  );
  const { width, height } = pictures[0].info;
  pictures.forEach(({ data }, index) => {
    if (!isOpaque(data)) {
      throw new Error(
        `frame ${index + 1} has transparent pixels — a keyframed animation ` +
          'blends its frames over each other, which needs them opaque'
      );
    }
  });

  // An unchanged frame stores nothing and lengthens the one before it.
  const parts: AnimationPart[] = [];
  pictures.forEach(({ data }, index) => {
    const previous = pictures[index - 1]?.data;
    const area =
      index % interval === 0
        ? { x: 0, y: 0, width, height }
        : changedArea(previous, data, width, height);
    if (!area) {
      parts[parts.length - 1].duration += delay;
      return;
    }
    const whole = area.width === width && area.height === height;
    parts.push({
      area,
      pixels: whole ? data : delta(previous, data, width, area),
      blend: !whole,
      duration: delay,
      shows: data
    });
  });

  const frameChunks = await Promise.all(
    parts.map(async (part) => {
      const still = await sharp(part.pixels, {
        raw: { width: part.area.width, height: part.area.height, channels: 4 }
      })
        .webp({ lossless: true })
        .toBuffer();
      return chunk('ANMF', Buffer.concat([anmfHeader(part), bitstream(still)]));
    })
  );

  const vp8x = Buffer.alloc(10);
  // Animation, and alpha: a blended frame's unchanged pixels are transparent.
  vp8x[0] = 0x02 | 0x10;
  vp8x.writeUIntLE(width - 1, 4, 3);
  vp8x.writeUIntLE(height - 1, 7, 3);
  // A transparent background, looping forever.
  const anim = Buffer.alloc(6);

  const body = Buffer.concat([
    Buffer.from('WEBP'),
    chunk('VP8X', vp8x),
    chunk('ANIM', anim),
    ...frameChunks
  ]);
  const size = Buffer.alloc(4);
  size.writeUInt32LE(body.length);
  const file = Buffer.concat([Buffer.from('RIFF'), size, body]);

  await assertDecodesTo(
    file,
    parts.map((part) => part.shows)
  );
  return file;
}

/** One stored frame of a keyframed animation, in canvas pixels. */
interface AnimationPart {
  area: { x: number; y: number; width: number; height: number };
  pixels: Buffer;
  blend: boolean;
  duration: number;
  /** The whole canvas once this part is drawn, for the self-check. */
  shows: Buffer;
}

function isOpaque(rgba: Buffer): boolean {
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] !== 255) return false;
  }
  return true;
}

/**
 * The rectangle covering every pixel that differs between two frames, `null`
 * for identical ones. Its corner is moved to even coordinates, which is all a
 * frame's offset can be stored as.
 */
function changedArea(
  previous: Buffer,
  current: Buffer,
  width: number,
  height: number
): AnimationPart['area'] | null {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (current.readUInt32LE(i) !== previous.readUInt32LE(i)) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) return null;
  left -= left % 2;
  top -= top % 2;
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/**
 * The area of `current`, with every pixel `previous` already shows made
 * transparent: blended over the previous frame, it adds only what changed,
 * and long runs of nothing compress to almost nothing.
 */
function delta(
  previous: Buffer,
  current: Buffer,
  width: number,
  area: AnimationPart['area']
): Buffer {
  const out = Buffer.alloc(area.width * area.height * 4);
  for (let y = 0; y < area.height; y++) {
    for (let x = 0; x < area.width; x++) {
      const from = ((area.y + y) * width + area.x + x) * 4;
      if (current.readUInt32LE(from) !== previous.readUInt32LE(from)) {
        current.copy(out, (y * area.width + x) * 4, from, from + 4);
      }
    }
  }
  return out;
}

/** An ANMF chunk's fixed fields: placement, duration, blending, disposal. */
function anmfHeader({ area, blend, duration }: AnimationPart): Buffer {
  const header = Buffer.alloc(16);
  header.writeUIntLE(area.x / 2, 0, 3);
  header.writeUIntLE(area.y / 2, 3, 3);
  header.writeUIntLE(area.width - 1, 6, 3);
  header.writeUIntLE(area.height - 1, 9, 3);
  header.writeUIntLE(duration, 12, 3);
  // Bit 1 set: replace the area rather than blend over it. Disposal: none.
  header[15] = blend ? 0 : 0b10;
  return header;
}

/** The image chunks of a single-frame WebP, as an ANMF chunk carries them. */
function bitstream(webp: Buffer): Buffer {
  const parts: Buffer[] = [];
  for (let at = 12; at < webp.length;) {
    const fourcc = webp.toString('latin1', at, at + 4);
    const end = at + 8 + webp.readUInt32LE(at + 4);
    const next = end + (end % 2);
    if (fourcc === 'VP8L' || fourcc === 'VP8 ' || fourcc === 'ALPH') {
      parts.push(webp.subarray(at, next));
    }
    at = next;
  }
  if (parts.length === 0) throw new Error('sharp wrote a WebP with no image');
  return Buffer.concat(parts);
}

/** A RIFF chunk: its four-letter type, its size, its payload, padded even. */
function chunk(fourcc: string, payload: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.write(fourcc, 0, 'latin1');
  header.writeUInt32LE(payload.length, 4);
  const pad = Buffer.alloc(payload.length % 2);
  return Buffer.concat([header, payload, pad]);
}

/**
 * Decodes what was written and compares every frame with the one it was
 * made from. The container is written by hand, so a mistake in it would
 * otherwise reach the page as a loop that draws garbage.
 */
async function assertDecodesTo(
  file: Buffer,
  expected: readonly Buffer[]
): Promise<void> {
  const { pages } = await sharp(file, {
    pages: -1,
    limitInputPixels: false
  }).metadata();
  if (pages !== expected.length) {
    throw new Error(
      `the keyframed animation holds ${pages} frames instead of ${expected.length}`
    );
  }
  for (let page = 0; page < expected.length; page++) {
    const decoded = await sharp(file, { page, limitInputPixels: false })
      .ensureAlpha()
      .raw()
      .toBuffer();
    if (!decoded.equals(expected[page])) {
      throw new Error(
        `the keyframed animation decodes frame ${page + 1} of ${pages} ` +
          'differently from the frame it was written from'
      );
    }
  }
}
