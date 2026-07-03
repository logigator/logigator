/**
 * Canvas text width as pure arithmetic. All canvas text renders in Roboto
 * Mono, whose every glyph advances 0.6 em, so a string's width is
 * `0.6 × fontSize × length` — no canvas measurement and no wrong-before-the-
 * webfont-loads metrics. DOM text keeps measurement-based fitting (the UI font
 * is not pinned to a monospace), so these helpers are canvas-only.
 */
export const CANVAS_FONT_FAMILY = 'Roboto Mono';

/** Roboto Mono glyph advance as a fraction of the font size. */
export const MONO_ADVANCE = 0.6;

/** Rendered width of `text` at `fontSize` (same unit as the font size). */
export function monoTextWidth(text: string, fontSize: number): number {
  return text.length * MONO_ADVANCE * fontSize;
}

/**
 * Largest font size ≤ `base` at which `text` fits into `maxWidth`, floored at
 * `min` — at the floor the text may overflow its slot (kept legible rather
 * than shrunk into noise).
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
