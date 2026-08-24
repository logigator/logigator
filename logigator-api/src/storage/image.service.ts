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
 * How a kind of image wants to be encoded. The two differ in every choice that
 * matters, so naming them beats threading four flags through the pipeline:
 *
 * - `photo` — an avatar. Cropped square (a face belongs in the middle, not in a
 *   letterbox), lossy WebP, and a JPEG fallback flattened onto white, since JPEG
 *   has no alpha and the alternative renders transparency as black.
 * - `lineArt` — a circuit preview. Padded square so nothing is cropped out,
 *   transparency kept, and lossless on both formats: hairlines are what a lossy
 *   encoder destroys first, and on this content it produces bigger files anyway.
 */
type EncodeMode = 'photo' | 'lineArt';

/**
 * The formats accepted from a client, as *detected from the bytes* rather than
 * declared in a header.
 *
 * The allowlist is the point of the check, not the convenience of it: libvips
 * also reads SVG, PDF, TIFF and more, and an SVG that got this far would be
 * rasterized into a perfectly valid avatar — turning "images only" into "any
 * document libvips can open".
 */
const ACCEPTED_FORMATS = new Set(['png', 'jpeg', 'webp']);

/**
 * Ceiling on the decoded size of an upload, in pixels.
 *
 * `UPLOAD_MAX_BYTES` bounds what arrives, not what it becomes: a few kilobytes
 * of PNG can describe a gigapixel canvas, and decoding it is the denial of
 * service. 40 megapixels sits above any camera whose output fits in the byte
 * limit and far below anything that threatens the process.
 */
const MAX_INPUT_PIXELS = 40_000_000;

/** Quality for the lossy encodes. High enough that an avatar shows no artifacts. */
const PHOTO_QUALITY = 82;

/**
 * Turns an uploaded image into the set of files that gets served.
 *
 * Re-encoding is not an optimization here, it is the validation: the bytes a
 * client sends are proof of nothing, and storing them verbatim under a
 * content type the same client chose is how an upload endpoint becomes a file
 * host. What comes out is decoded by libvips, oriented, resized to a matrix this
 * server chose, and re-encoded with no metadata carried over — so the camera
 * position in an avatar's EXIF does not become public, and nothing reaches the
 * volume that could not be decoded first.
 */
@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  /** The files an avatar upload becomes. */
  async encodeAvatar(source: Buffer): Promise<AssetFile[]> {
    return this.derive(source, AVATAR_VARIANTS, 'photo');
  }

  /** The files a preview upload becomes, both themes in one asset. */
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
   * Decodes once, then encodes every variant from the result.
   *
   * The intermediate is raw pixels at the largest size the matrix asks for:
   * every variant is at most that, so each one costs a downscale instead of
   * another decode of the original, and a five-megabyte JPEG is read exactly
   * once no matter how wide the matrix grows.
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
        // Everything below is our own doing, so a failure here is a defect and
        // belongs in the 500 it will become — unlike `normalize`, where a
        // failure is the upload's fault and says so.
        content: await this.encode(master, spec, mode)
      }))
    );
  }

  /**
   * Decodes the upload and squares it, answering raw pixels.
   *
   * Everything a client can get wrong fails here, which is why it is one step:
   * a format we will not serve, a decode error, a pixel count meant to exhaust
   * the process. The answer is the same for all of them — the image is not
   * usable, and no amount of retrying the same bytes changes that.
   */
  private async normalize(
    source: Buffer,
    size: number,
    mode: EncodeMode
  ): Promise<Sharp> {
    // `failOn: 'error'` rather than the stricter default: a warning is usually
    // trailing junk after an otherwise perfect JPEG, which no viewer minds and
    // rejecting would only frustrate. A checksum that does not match is
    // different — the file is damaged, and telling the client so beats storing
    // whatever the decoder guessed.
    const image = sharp(source, {
      failOn: 'error',
      limitInputPixels: MAX_INPUT_PIXELS,
      // Only the first frame of an animation. A still avatar is what every
      // surface showing one expects, and it costs nothing to guarantee.
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
      // `rotate()` before anything else applies the EXIF orientation while it is
      // still there to read — the re-encode drops that metadata, so a phone
      // photo would otherwise be stored on its side.
      const { data, info } = await image
        .rotate()
        .resize(size, size, {
          // Enlarging a small upload is deliberate: the matrix is a constant, so
          // every URL in it has to resolve, and a variant that quietly came out
          // narrower than it claims would make `srcset` pick it wrongly.
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
    // The master is already square and at least this big, so this is a plain
    // downscale — or nothing at all, at the rung the master was made for.
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
   * One answer for every way an upload can fail to become an image, because a
   * client can act on only one thing: send a different file. Which decoder
   * complained about what stays server-side — naming it in the response would
   * describe this stack to anyone probing it — but it is logged, so a report of
   * "my avatar will not upload" leaves something to read.
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
