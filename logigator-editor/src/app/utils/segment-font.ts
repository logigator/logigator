/**
 * Bitmap-font names for the segment-display readout, installed by
 * `AssetsService` from the DSEG woff2 faces (Roboto-Mono-atlas pattern —
 * see `text-fit.ts`). DSEG7 covers seven-segment digits; DSEG14 adds the
 * fourteen-segment hex letters.
 */
export const SEGMENT_FONT_7 = 'DSEG7';
export const SEGMENT_FONT_14 = 'DSEG14';

/**
 * Glyphs baked into the segment atlases: the readout is only ever digits plus
 * lowercase hex letters (`Number.prototype.toString(16)` output).
 */
export const SEGMENT_FONT_CHARS: string[][] = [
  ['0', '9'],
  ['a', 'f']
];
