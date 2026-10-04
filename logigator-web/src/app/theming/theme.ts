/** The two schemes `@logigator/ui` defines tokens for. */
export const THEMES = ['light', 'dark'] as const;

export type ThemeId = (typeof THEMES)[number];

/**
 * The scheme applied to a visitor who has expressed no preference. Dark is the
 * editor's default too, so the first page view and the first board look alike.
 */
export const DEFAULT_THEME: ThemeId = 'dark';

/** The class `@logigator/ui`'s dark token overrides key off, set on `<html>`. */
export const DARK_THEME_CLASS = 'dark-mode';

export function isThemeId(theme: string | null | undefined): theme is ThemeId {
  return THEMES.some((known) => known === theme);
}
