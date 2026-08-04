/**
 * Localized calendar date, e.g. "Jul 22, 2026" / "22. Juli 2026". Takes what a
 * timestamp arrives as from the API (an ISO string) or from a store (epoch ms),
 * and formats it through `Intl` in the given language — so the date follows the
 * interface language rather than the build's `LOCALE_ID`, and no locale data
 * has to be registered for it.
 */
export function formatLocalDate(
  value: string | number | Date,
  locale: string
): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(value)
  );
}
