import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import sharp, { type Sharp } from 'sharp';
import type { AssetFile } from './file-storage.service';
import { ImageService } from './image.service';
import { AVATAR_VARIANTS, PREVIEW_VARIANTS } from './image-variants';

const images = new ImageService();

/** Solid colour of the given size, as a real encoded file. */
function solid(
  width: number,
  height: number,
  colour = { r: 200, g: 40, b: 40 }
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: colour }
  })
    .png()
    .toBuffer();
}

/** Half red, half blue along the long edge, so an orientation is observable. */
async function twoTone(width: number, height: number): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      if (x < width / 2) raw[i] = 255;
      else raw[i + 2] = 255;
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 100 })
    .toBuffer();
}

function byName(files: AssetFile[]): Map<string, Buffer> {
  return new Map(files.map((file) => [file.name, file.content]));
}

async function pixel(
  content: Buffer,
  x: number,
  y: number
): Promise<{ r: number; g: number; b: number; alpha: number }> {
  const { data, info } = await sharp(content)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return { r: data[i], g: data[i + 1], b: data[i + 2], alpha: data[i + 3] };
}

describe('an encoded avatar', () => {
  let files: Map<string, Buffer>;

  beforeAll(async () => {
    files = byName(await images.encodeAvatar(await solid(300, 300)));
  });

  /**
   * Responses list the matrix without reading the volume, so a file that came
   * out at another size or format would be advertised — and picked — wrongly.
   */
  it('is exactly what the matrix advertises', async () => {
    expect([...files.keys()].sort()).toEqual(
      AVATAR_VARIANTS.map((spec) => spec.file).sort()
    );

    for (const spec of AVATAR_VARIANTS) {
      const metadata = await sharp(files.get(spec.file)).metadata();
      expect({
        file: spec.file,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format
      }).toEqual({
        file: spec.file,
        width: spec.width,
        height: spec.height,
        format: spec.format
      });
    }
  });

  /**
   * The re-encode drops the EXIF block, so the orientation in it has to be
   * spent first.
   */
  it('applies the EXIF orientation before discarding the metadata', async () => {
    // Orientation 6 is a quarter turn clockwise: red moves from the left half
    // to the top half. Without it, a square crop takes the middle band and
    // mixes both colours.
    const rotated = await sharp(await twoTone(64, 32))
      .withMetadata({ orientation: 6 })
      .jpeg({ quality: 100 })
      .toBuffer();

    const encoded = byName(await images.encodeAvatar(rotated));
    const top = await pixel(encoded.get('64.webp') as Buffer, 32, 8);
    const bottom = await pixel(encoded.get('64.webp') as Buffer, 32, 55);

    expect(top.r).toBeGreaterThan(200);
    expect(top.b).toBeLessThan(60);
    expect(bottom.b).toBeGreaterThan(200);
    expect(bottom.r).toBeLessThan(60);
  });

  it('takes the first frame of an animated GIF', async () => {
    // Two 32×32 frames, red then blue, stacked as pages.
    const raw = Buffer.alloc(32 * 64 * 3);
    for (let i = 0; i < 32 * 32; i++) {
      raw[i * 3] = 255;
      raw[(32 * 32 + i) * 3 + 2] = 255;
    }
    const gif = await sharp(raw, {
      raw: { width: 32, height: 64, channels: 3, pageHeight: 32 }
    })
      .gif()
      .toBuffer();

    const encoded = byName(await images.encodeAvatar(gif));
    const avatar = encoded.get('256.webp') as Buffer;

    const centre = await pixel(avatar, 128, 128);
    expect(
      (await sharp(avatar, { animated: true }).metadata()).pages ?? 1
    ).toBe(1);
    expect(centre.r).toBeGreaterThan(200);
    expect(centre.b).toBeLessThan(60);
  });

  it('keeps transparency', async () => {
    const transparent = await sharp({
      create: {
        width: 300,
        height: 300,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .png()
      .toBuffer();

    const encoded = byName(await images.encodeAvatar(transparent));

    expect(await pixel(encoded.get('256.webp') as Buffer, 4, 4)).toMatchObject({
      alpha: 0
    });
  });

  /** A face belongs in the frame, not in a letterbox with bars around it. */
  it('crops a non-square source to fill the frame', async () => {
    const encoded = byName(await images.encodeAvatar(await solid(256, 64)));

    for (const [x, y] of [
      [1, 1],
      [62, 62]
    ]) {
      expect(await pixel(encoded.get('64.webp') as Buffer, x, y)).toMatchObject(
        {
          alpha: 255
        }
      );
    }
  });

  it('enlarges a source smaller than the matrix, so every URL resolves', async () => {
    const encoded = byName(await images.encodeAvatar(await solid(8, 8)));

    expect((await sharp(encoded.get('256.webp')).metadata()).width).toBe(256);
  });
});

describe('encoded previews', () => {
  let files: Map<string, Buffer>;

  beforeAll(async () => {
    files = byName(
      await images.encodePreviews({
        light: await solid(256, 128, { r: 250, g: 250, b: 250 }),
        dark: await solid(256, 128, { r: 20, g: 20, b: 20 })
      })
    );
  });

  it('are exactly what the matrix advertises, both themes in one set', async () => {
    expect([...files.keys()].sort()).toEqual(
      PREVIEW_VARIANTS.map((spec) => spec.file).sort()
    );

    for (const spec of PREVIEW_VARIANTS) {
      const metadata = await sharp(files.get(spec.file)).metadata();
      expect({
        file: spec.file,
        width: metadata.width,
        format: metadata.format
      }).toEqual({
        file: spec.file,
        width: spec.width,
        format: spec.format
      });
    }
  });

  /**
   * The two renders differ only in theme, so swapped sources would still
   * produce a complete, plausible-looking set.
   */
  it('keep the render of each theme in its own slot', async () => {
    const light = await pixel(files.get('light-512.webp') as Buffer, 256, 256);
    const dark = await pixel(files.get('dark-512.webp') as Buffer, 256, 256);

    expect(light.r).toBeGreaterThan(200);
    expect(dark.r).toBeLessThan(60);
  });

  /**
   * Padded rather than cropped: a wide board losing its outer thirds would be a
   * thumbnail of the wrong circuit. The padding is transparent, as the editor
   * renders on.
   */
  it('pad to square instead of cropping, on transparency', async () => {
    const content = files.get('light-512.webp') as Buffer;

    expect(await pixel(content, 256, 16)).toMatchObject({ alpha: 0 });
    expect(await pixel(content, 256, 256)).toMatchObject({ alpha: 255 });
  });

  /**
   * Near-lossless, not lossy: anti-aliased hairlines are what a lossy encoder
   * smears first, so every rung stays within two levels of the exact render
   * scaled to the same size.
   */
  it('keep WebP within two levels of the exact render', async () => {
    const hairlines = await hairlineRender().png().toBuffer();
    const encoded = byName(
      await images.encodePreviews({ light: hairlines, dark: hairlines })
    );

    for (const spec of PREVIEW_VARIANTS) {
      const exact = await sharp(hairlines)
        .resize(spec.width, spec.height)
        .png()
        .toBuffer();
      expect({
        file: spec.file,
        difference: await largestDifference(
          encoded.get(spec.file) as Buffer,
          exact
        )
      }).toEqual({ file: spec.file, difference: expect.toBeOneOf([0, 1, 2]) });
    }
  });

  /**
   * The editor uploads lossless WebP where the browser writes it and PNG
   * elsewhere, so which one arrived must not show in what is served.
   */
  it('come out the same from a lossless WebP render as from a PNG one', async () => {
    const [fromPng, fromWebp] = await Promise.all(
      [
        hairlineRender().png().toBuffer(),
        hairlineRender().webp({ lossless: true }).toBuffer()
      ].map(async (render) => {
        const source = await render;
        return byName(
          await images.encodePreviews({ light: source, dark: source })
        );
      })
    );

    for (const spec of PREVIEW_VARIANTS) {
      expect({
        file: spec.file,
        difference: await largestDifference(
          fromWebp.get(spec.file) as Buffer,
          fromPng.get(spec.file) as Buffer
        )
      }).toEqual({ file: spec.file, difference: 0 });
    }
  });
});

/** Anti-aliased diagonal hairlines on transparency: a board, as previewed. */
function hairlineRender(): Sharp {
  return sharp(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">' +
        Array.from(
          { length: 40 },
          (_, i) =>
            `<line x1="0" y1="${i * 25.3}" x2="1024" y2="${i * 25.3 + 300}" stroke="#27ae60" stroke-width="1.3"/>`
        ).join('') +
        '</svg>'
    )
  );
}

/** The largest difference in any channel, alpha included, between two images. */
async function largestDifference(a: Buffer, b: Buffer): Promise<number> {
  const [left, right] = await Promise.all(
    [a, b].map((image) => sharp(image).ensureAlpha().raw().toBuffer())
  );
  let largest = 0;
  for (let i = 0; i < left.length; i++) {
    largest = Math.max(largest, Math.abs(left[i] - right[i]));
  }
  return largest;
}

describe('an upload that is not a usable image', () => {
  beforeAll(() => {
    // Each refusal logs why; a passing suite should not read like a failure.
    vi.spyOn(Logger.prototype, 'debug').mockReturnValue(undefined);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it.each([
    [
      'an SVG, which libvips would happily rasterize',
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>'
      )
    ],
    ['bytes of no image format at all', Buffer.from('not an image at all')],
    [
      // A 1×1 PNG whose IDAT checksum does not match its data. Browsers render
      // it, libpng refuses it, and re-encoding turns that into an answer the
      // client can act on.
      'a PNG with a damaged chunk',
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
        'base64'
      )
    ]
  ])('is refused: %s', async (_, content) => {
    await expect(images.encodeAvatar(content)).rejects.toMatchObject({
      status: 415
    });
  });
});
