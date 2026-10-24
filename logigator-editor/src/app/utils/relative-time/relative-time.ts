/**
 * Localized relative time from now. Picks the largest whole unit and uses
 * `numeric: 'auto'` so near-now values read naturally ("now", "yesterday").
 * Snapshots against the current time per call; it does not tick.
 */
export function formatRelativeTime(epochMs: number, locale: string): string {
  const diffSec = Math.round((epochMs - Date.now()) / 1000); // negative = past
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60]
  ];
  for (const [unit, secs] of units) {
    if (abs >= secs) return rtf.format(Math.round(diffSec / secs), unit);
  }
  return rtf.format(diffSec, 'second');
}
