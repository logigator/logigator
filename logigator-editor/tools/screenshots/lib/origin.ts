import type { Cookie } from 'playwright';
import type { LanguageId } from '../../../../logigator-core/src/origin/languages.ts';
import './runtime.ts';

/**
 * The origin-wide contracts core holds — the `preferences` cookie codec and the
 * language set — loaded from its TypeScript source rather than restated here.
 * A capture that renders in a language or scheme the run did not ask for fails
 * silently and plausibly, so the encoding a target writes must be the one the
 * apps read.
 */

const { encodePreferences } =
  await import('../../../../logigator-core/src/origin/preferences-cookie.ts');
const { AVAILABLE_LANGUAGES, isAvailableLanguage } =
  await import('../../../../logigator-core/src/origin/languages.ts');

export type { LanguageId };

/**
 * The languages the origin speaks, in switcher order — English first. The
 * objects are core's own, so a consumer deriving from them cannot drift from
 * what the apps read.
 */
export const LANGUAGES = AVAILABLE_LANGUAGES;

/** The languages the origin speaks, as their ids. */
export const LOCALES: readonly LanguageId[] = AVAILABLE_LANGUAGES.map(
  ({ id }) => id
);

/**
 * The colour schemes a page can be in — the `theme` field's two values, light
 * first. The same vocabulary the `dark-mode` class and `prefers-color-scheme`
 * use, and what makes the default a baseline rather than the dark one.
 */
export const THEMES = ['light', 'dark'] as const;

export type Theme = (typeof THEMES)[number];

/**
 * The `preferences` cookie as a shot's browser context is given it, at the
 * origin the run is aimed at. Both apps read the language and the scheme out of
 * this one cookie, so it is how a pass reaches either of them.
 *
 * Both fields are checked, because the codec drops an `undefined` while
 * encoding: a pass missing one writes a cookie that is silently short, and the
 * app then falls back for that field on its own — a capture in a language or
 * scheme the run did not ask for, with nothing to show for it.
 */
export function preferencesCookie(
  lang: LanguageId,
  theme: Theme,
  origin: string
): Pick<Cookie, 'name' | 'value'> & { url: string } {
  if (!isAvailableLanguage(lang)) {
    throw new Error(
      `the preferences cookie needs a language — ${JSON.stringify(lang)} is ` +
        `not one of ${LOCALES.join(', ')}`
    );
  }
  if (!THEMES.includes(theme)) {
    throw new Error(
      `the preferences cookie needs a scheme — ${JSON.stringify(theme)} is ` +
        `not one of ${THEMES.join(', ')}`
    );
  }
  return {
    name: 'preferences',
    value: encodePreferences({ lang, theme }),
    url: origin
  };
}
