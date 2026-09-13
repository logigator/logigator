import path from 'node:path';

/**
 * The tour figures' captures, as the site consumes them. The languages and the
 * colour schemes are the run's — `lib/config.mjs` owns what the origin speaks —
 * and the scheme reaches the app through the `preferences` cookie
 * `Editor.open` installs, which is what the site's render reads.
 */
export const TARGET = {
  /** The features page, which the editor's SPA sits beside at the same origin. */
  base: 'http://logigator.test',
  /** Where the media lands under the out-dir, and the import map over it. */
  layout: () => MEDIA_DIR
};

export const MEDIA_DIR = path.join('src', 'assets', 'tour');
export const REGISTRY_FILE = path.join(
  'src',
  'app',
  'pages',
  'features',
  'tour-media.ts'
);

/**
 * The scheme and language are part of the name: the page picks between them, so
 * English's copy has to be addressable beside the others rather than standing
 * in for them.
 */
export function fileName(shot, pass) {
  return `${shot.name}-${pass.lang}-${pass.theme}.webp`;
}
