/**
 * Bitmap-font names for the segment-display readout, installed by
 * `AssetsService` from the DSEG woff2 faces. DSEG7 covers seven-segment digits;
 * DSEG14 adds the fourteen-segment hex letters.
 */
export const SEGMENT_FONT_7 = 'DSEG7';
export const SEGMENT_FONT_14 = 'DSEG14';

/** Glyphs baked into the segment atlases: digits and lowercase hex letters. */
export const SEGMENT_FONT_CHARS: string[][] = [
  ['0', '9'],
  ['a', 'f']
];

export interface SegmentFontMetrics {
  /** Glyph advance in em; the faces are monospaced, so every glyph shares it. */
  advance: number;
  /** Single-line readout height in em, tuned for subscript placement. */
  lineHeight: number;
}

/**
 * Arithmetic metrics for the segment faces. Draw-time code must size readouts
 * from these rather than measure a BitmapText: components can draw before
 * `AssetsService.init()` installs the atlases, and PixiJS measures an unknown
 * bitmap-font family through a silently created fallback `DynamicBitmapFont`
 * with entirely different metrics.
 */
export const SEGMENT_FONT_METRICS: Record<string, SegmentFontMetrics> = {
  [SEGMENT_FONT_7]: { advance: 0.816, lineHeight: 1 },
  [SEGMENT_FONT_14]: { advance: 0.816, lineHeight: 1 }
};
