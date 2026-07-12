import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeTime } from './relative-time';

describe('formatRelativeTime', () => {
  afterEach(() => vi.useRealTimers());

  it('picks the largest whole unit for past times (en)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    expect(formatRelativeTime(Date.now() - 2 * 60_000, 'en')).toBe(
      '2 minutes ago'
    );
    expect(formatRelativeTime(Date.now() - 3 * 3_600_000, 'en')).toBe(
      '3 hours ago'
    );
    expect(formatRelativeTime(Date.now() - 24 * 3_600_000, 'en')).toBe(
      'yesterday'
    );
  });

  it('falls back to seconds under a minute, and "now" at zero', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    expect(formatRelativeTime(Date.now() - 5000, 'en')).toBe('5 seconds ago');
    expect(formatRelativeTime(Date.now(), 'en')).toBe('now');
  });

  it('honors the locale', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    expect(formatRelativeTime(Date.now() - 2 * 60_000, 'de')).toBe(
      'vor 2 Minuten'
    );
  });
});
