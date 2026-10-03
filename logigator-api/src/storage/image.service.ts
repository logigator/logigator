import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import sharp, { type Sharp } from 'sharp';
import { ApiException } from '../common/api-exception';
import type { AssetFile } from './file-storage.service';
import {
  AVATAR_VARIANTS,
  IMAGE_SLOTS,
  PREVIEW_VARIANTS,
  type ImageSlot,
  type ImageVariantSpec
} from './image-variants';

/**
 * - `photo` — an avatar. Cropped square, lossy WebP, JPEG fallback flattened
 *   onto white (JPEG has no alpha, and transparency would render black).
 * - `lineArt` — a circuit preview. Padded square so nothing is cropped,
 *   transparency kept, lossless: hairlines are what a lossy encoder destroys
 *   first, and on this content it produces bigger files anyway.
 */
type EncodeMode = 'photo' | 'lineArt';

/**
 * Accepted formats, as *detected from the bytes* rather than declared in a
 * header. The allowlist is the point: libvips also reads SVG, PDF and TIFF, and
 * an SVG would rasterize into a perfectly valid avatar.
 */
const ACCEPTED_FORMATS = new Set(['png', 'jpeg', 'webp']);

/**
 * Ceiling on the decoded size of an upload. `UPLOAD_MAX_BYTES` bounds what
 * arrives, not what it becomes — a few kilobytes of PNG can describe a
 * gigapixel canvas, and decoding it is the denial of service.
 */
const MAX_INPUT_PIXELS = 40_000_000;

const PHOTO_QUALITY = 82;

/**
 * Turns an uploaded image into the set of files that gets served.
 *
 * Re-encoding is the validation: client bytes are proof of nothing, and storing
 * them verbatim under a client-chosen content type makes this a file host.
 * Everything served was decoded by libvips, oriented, resized to a matrix this
 * server chose, and re-encoded with no metadata carried over.
 */
@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  async encodeAvatar(source: Buffer): Promise<AssetFile[]> {
    return this.derive(source, AVATAR_VARIANTS, 'photo');
  }

  /** Both themes in one asset. */
  async encodePreviews(
    sources: Readonly<Record<ImageSlot, Buffer>>
  ): Promise<AssetFile[]> {
    const perSlot = await Promise.all(
      IMAGE_SLOTS.map((slot) =>
        this.derive(
          sources[slot],
          PREVIEW_VARIANTS.filter((spec) => spec.slot === slot),
          'lineArt'
        )
      )
    );
    return perSlot.flat();
  }

  /**
   * Decodes once, then encodes every variant from the result. The intermediate
   * is raw pixels at the largest size the matrix asks for, so each variant
   * costs a downscale rather than another decode of the original.
   */
  private async derive(
    source: Buffer,
    specs: readonly ImageVariantSpec[],
    mode: EncodeMode
  ): Promise<AssetFile[]> {
    const largest = Math.max(...specs.map((spec) => spec.width));
    const master = await this.normalize(source, largest, mode);

    return Promise.all(
      specs.map(async (spec) => ({
        name: spec.file,
        // A failure here is our defect, not the upload's, so it stays a 500 —
        // unlike `normalize`, which answers the client.
        content: await this.encode(master, spec, mode)
      }))
    );
  }

  /**
   * Decodes the upload and squares it, answering raw pixels. Everything a
   * client can get wrong fails here — unservable format, decode error, a pixel
   * count meant to exhaust the process — and all of it gets one answer.
   */
  private async normalize(
    source: Buffer,
    size: number,
    mode: EncodeMode
  ): Promise<Sharp> {
    // `failOn: 'error'`, not the stricter default: a warning is usually
    // trailing junk after an otherwise perfect JPEG, which no viewer minds.
    const image = sharp(source, {
      failOn: 'error',
      limitInputPixels: MAX_INPUT_PIXELS,
      // First frame only; a still avatar is what every surface expects.
      animated: false
    });

    let format: string | undefined;
    try {
      ({ format } = await image.metadata());
    } catch (error) {
      throw this.unreadable(error);
    }
    if (!format || !ACCEPTED_FORMATS.has(format)) {
      throw this.unreadable(`detected format: ${format ?? 'none'}`);
    }

    try {
      // `rotate()` first applies the EXIF orientation while it is still there
      // to read; the re-encode drops that metadata.
      const { data, info } = await image
        .rotate()
        .resize(size, size, {
          // Small uploads are enlarged on purpose: the matrix is a constant, so
          // every URL has to resolve, and a variant narrower than it claims
          // would make `srcset` pick it wrongly.
          fit: mode === 'photo' ? 'cover' : 'contain',
          position: 'centre',
          background: TRANSPARENT
        })
        // Uniform channel count, so the raw buffer below needs no branching.
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      return sharp(data, {
        raw: {
          width: info.width,
          height: info.height,
          channels: info.channels
        }
      });
    } catch (error) {
      throw this.unreadable(error);
    }
  }

  private encode(
    master: Sharp,
    spec: ImageVariantSpec,
    mode: EncodeMode
  ): Promise<Buffer> {
    // The master is square and at least this big, so this only ever downscales.
    const image = master.clone().resize(spec.width, spec.height);

    switch (spec.format) {
      case 'webp':
        return image
          .webp(
            mode === 'photo' ? { quality: PHOTO_QUALITY } : { lossless: true }
          )
          .toBuffer();
      case 'jpeg':
        return image
          .flatten({ background: '#ffffff' })
          .jpeg({ quality: PHOTO_QUALITY, mozjpeg: true })
          .toBuffer();
      case 'png':
        return image.png({ compressionLevel: 9 }).toBuffer();
    }
  }

  /**
   * One answer for every way an upload fails to become an image: a client can
   * only send a different file. The decoder's complaint stays server-side —
   * naming it describes this stack to anyone probing — but is logged.
   */
  private unreadable(cause: unknown): ApiException {
    this.logger.debug(`Refused an upload that would not decode: ${cause}`);
    return new ApiException(
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      'bad_request',
      'The file could not be read as a PNG, JPEG or WebP image.'
    );
  }
}

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
