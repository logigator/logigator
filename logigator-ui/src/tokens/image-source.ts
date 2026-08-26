/**
 * One encoding of one image at one size.
 *
 * The inputs that take a whole ladder of these rather than a single URL hand
 * the choice to the browser: `srcset` picks the width for the device's pixel
 * ratio, `<picture>` picks the first encoding it can decode. Neither the
 * component nor the caller has to know which is best on a given device.
 *
 * Structural on purpose, so a caller passes its own list straight in: this is
 * the shape a server that encodes several variants of an image already answers
 * with. `format` is the format's *name* (`'webp'`, `'jpeg'`, `'png'`), not a
 * media type or a file extension.
 */
export interface LgImageSource {
  url: string;
  /** Intrinsic width in pixels; becomes the `srcset` width descriptor. */
  width: number;
  /**
   * Absent means "no alternatives to choose between" — every source lands on
   * one `srcset` and the browser picks purely by width.
   */
  format?: string;
}
