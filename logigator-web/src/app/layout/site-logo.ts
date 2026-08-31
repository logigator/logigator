import logoOnLight from '../../assets/logo-on-light.svg';
import logoOnDark from '../../assets/logo-on-dark.svg';

/**
 * The wordmark, in the two inks it exists in. It is two-tone artwork — only the
 * lettering changes colour — so it cannot be recoloured with `currentColor` the
 * way an icon can, and each scheme needs its own file.
 *
 * Imported rather than linked from `public/`, so the build hashes them: a
 * revised wordmark then reaches everyone on the next deploy instead of waiting
 * out a cache.
 */
export const SITE_LOGO = {
  /** For a light background. */
  onLight: logoOnLight,
  /** For a dark background. */
  onDark: logoOnDark
} as const;
