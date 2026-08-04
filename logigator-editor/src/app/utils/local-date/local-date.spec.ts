import { describe, expect, it } from 'vitest';
import { formatLocalDate } from './local-date';

describe('formatLocalDate', () => {
  const iso = '2026-07-22T12:00:00Z';

  it('formats the date in the given language', () => {
    expect(formatLocalDate(iso, 'en')).toBe('Jul 22, 2026');
    expect(formatLocalDate(iso, 'de')).toBe('22.07.2026');
    expect(formatLocalDate(iso, 'fr')).toBe('22 juil. 2026');
    expect(formatLocalDate(iso, 'es')).toBe('22 jul 2026');
  });

  it('takes an ISO string, epoch ms or Date alike', () => {
    const epoch = Date.parse(iso);
    expect(formatLocalDate(epoch, 'en')).toBe(formatLocalDate(iso, 'en'));
    expect(formatLocalDate(new Date(epoch), 'en')).toBe(
      formatLocalDate(iso, 'en')
    );
  });
});
