/**
 * One encoding of one image at one size. An input taking a ladder of these
 * hands the choice to the browser: `srcset` picks the width for the pixel
 * ratio, `<picture>` the first encoding it can decode.
 *
 * Structural on purpose, so a caller passes its own list straight in.
 * `format` is the format's *name* (`'webp'`), not a media type or extension.
 */
export interface LgImageSource {
  url: string;
  /** Intrinsic width in pixels; becomes the `srcset` width descriptor. */
  width: number;
  /** Absent means no alternatives: one `srcset`, chosen purely by width. */
  format?: string;
}
