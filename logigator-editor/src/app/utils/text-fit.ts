/**
 * Canvas text width as pure arithmetic. All canvas text renders in Roboto Mono,
 * whose every glyph advances 0.6 em, so a string's width is
 * `0.6 × fontSize × length` — no measurement, and no wrong metrics before the
 * webfont loads. DOM text is not pinned to a monospace, so this is canvas-only.
 */
export const CANVAS_FONT_FAMILY = 'Roboto Mono';

/**
 * Glyphs baked into the canvas bitmap-font atlas: printable ASCII, Latin-1 and
 * Latin Extended-A. BitmapText silently drops anything outside it, and the
 * subset woff2 in assets/ covers exactly this set — keep the two in sync.
 */
export const CANVAS_FONT_CHARS: string[][] = [
  [' ', '~'],
  ['\u00a0', '\u00ff'],
  ['\u0100', '\u017f']
];

/** Roboto Mono glyph advance as a fraction of the font size. */
export const MONO_ADVANCE = 0.6;

/** Rendered width of `text` at `fontSize` (same unit as the font size). */
export function monoTextWidth(text: string, fontSize: number): number {
  return text.length * MONO_ADVANCE * fontSize;
}

/**
 * Largest font size ≤ `base` at which `text` fits into `maxWidth`, floored at
 * `min`. At the floor the text may overflow rather than shrink into noise.
 */
export function fitMonoFontSize(
  text: string,
  maxWidth: number,
  base: number,
  min: number
): number {
  if (text.length === 0) {
    return base;
  }
  return Math.max(min, Math.min(base, maxWidth / (text.length * MONO_ADVANCE)));
}
