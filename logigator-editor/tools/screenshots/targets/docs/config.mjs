import path from 'node:path';

/**
 * The documentation's own half of a run. What the origin speaks and how a
 * colour scheme is staged are not here: `lib/config.mjs` holds both, because
 * neither is a documentation fact.
 */
export const TARGET = {
  /**
   * Driven with `yarn start:editor:prod --define "AUTOMATION_API=true"`. The
   * editor serves this path in development too, which is enough for every shot
   * that does not need the API.
   */
  base: 'http://localhost:4200/editor',
  /** Where the localized image folders land under the out-dir. */
  layout: (lang) => path.join('src', 'pages', lang, 'images')
};

/** One file per shot; there is no language or theme in the name. */
export function fileName(shot) {
  return `${shot.name}.webp`;
}

/**
 * Narrowest desktop viewport, for shots whose subject spans the whole window.
 * The binding constraint is the tool bar wrapping to a second row, not the
 * compact breakpoint: its buttons are labelled, so the wrap point follows the
 * language. Measured on the bar of the day, English, German and Spanish all
 * fit at 1130 and French needs 1200 — it wrapped to 109 px there while the
 * other three stayed at 59. This is that plus headroom, shared by every
 * language so the bars frame alike; `Editor.requireSingleRowToolBar` is what
 * catches the day the bar outgrows it, which is how this number was found
 * wanting the last time.
 */
export const NARROW_VIEWPORT = { width: 1210 };
