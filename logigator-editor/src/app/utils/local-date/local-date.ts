/**
 * Localized calendar date from an ISO string (as the API sends) or epoch ms (as
 * a store holds). Formatting through `Intl` makes the date follow the interface
 * language rather than the build's `LOCALE_ID`, with no locale data to register.
 */
export function formatLocalDate(
  value: string | number | Date,
  locale: string
): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(value)
  );
}
