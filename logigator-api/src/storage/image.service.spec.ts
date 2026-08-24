import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import sharp from 'sharp';
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
   * The response lists the matrix without reading the volume, so a file that
   * came out at another size or in another format would be advertised wrongly
   * and `srcset` would pick it on that false claim.
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
   * The re-encode drops the EXIF block — which is the point, a phone's location
   * has no business being served — so the orientation in it has to be spent
   * before it goes.
   */
  it('applies the EXIF orientation before discarding the metadata', async () => {
    // Orientation 6 is a quarter turn clockwise: red moves from the left half
    // to the top half. Without it, cropping this landscape source to a square
    // takes the middle band and mixes both colours instead.
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

  /**
   * JPEG has no alpha channel, and an unflattened transparent source comes out
   * of one as black — so a logo with a transparent ground would be served as a
   * black square to every client that gets the fallback.
   */
  it('keeps transparency in WebP and flattens it onto white for JPEG', async () => {
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
    const fallback = await pixel(encoded.get('256.jpg') as Buffer, 4, 4);
    expect(fallback.alpha).toBe(255);
    expect(fallback.r).toBeGreaterThan(250);
    expect(fallback.g).toBeGreaterThan(250);
    expect(fallback.b).toBeGreaterThan(250);
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
   * The two renders differ only in theme, so an encode that mixed up its sources
   * would still produce a complete, plausible-looking set — worth pinning that
   * each slot carries its own image.
   */
  it('keep the render of each theme in its own slot', async () => {
    const light = await pixel(files.get('light-256.webp') as Buffer, 128, 128);
    const dark = await pixel(files.get('dark-256.webp') as Buffer, 128, 128);

    expect(light.r).toBeGreaterThan(200);
    expect(dark.r).toBeLessThan(60);
  });

  /**
   * A preview is padded rather than cropped: a wide board losing its left and
   * right thirds to a square crop would be a thumbnail of the wrong circuit.
   * The padding is transparent, which is also what the editor renders on.
   */
  it('pad to square instead of cropping, on transparency', async () => {
    const content = files.get('light-256.png') as Buffer;

    expect(await pixel(content, 128, 8)).toMatchObject({ alpha: 0 });
    expect(await pixel(content, 128, 128)).toMatchObject({ alpha: 255 });
  });
});

describe('an upload that is not a usable image', () => {
  beforeAll(() => {
    // Each refusal logs why, and a passing suite should not read like a failing
    // one.
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
      // it; libpng refuses it — and re-encoding is what turns that from a
      // stored-and-broken file into an answer the client can act on.
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
