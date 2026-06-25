import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { LayoutService } from './layout.service';

const COMPACT_QUERY = '(max-width: 767.98px)';
const COARSE_QUERY = '(pointer: coarse)';

interface FakeMql {
  matches: boolean;
  listeners: ((e: { matches: boolean }) => void)[];
}

describe('LayoutService', () => {
  let mqls: Map<string, FakeMql>;

  /** Installs a controllable matchMedia keyed by query string. */
  function setupMatchMedia(initial: Record<string, boolean>): void {
    mqls = new Map();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string): MediaQueryList => {
        let entry = mqls.get(query);
        if (!entry) {
          entry = { matches: initial[query] ?? false, listeners: [] };
          mqls.set(query, entry);
        }
        const captured = entry;
        return {
          get matches() {
            return captured.matches;
          },
          media: query,
          addEventListener: (
            _: string,
            cb: (e: { matches: boolean }) => void
          ) => captured.listeners.push(cb),
          removeEventListener: vi.fn()
        } as unknown as MediaQueryList;
      }
    });
  }

  function fireChange(query: string, matches: boolean): void {
    const entry = mqls.get(query)!;
    entry.matches = matches;
    entry.listeners.forEach((cb) => cb({ matches }));
  }

  beforeEach(() => {
    configureTestBed();
  });

  it('reads initial isCompact / isTouch from matchMedia', () => {
    setupMatchMedia({ [COMPACT_QUERY]: true, [COARSE_QUERY]: true });
    const service = TestBed.inject(LayoutService);
    expect(service.isCompact()).toBe(true);
    expect(service.isTouch()).toBe(true);
    expect(service.breakpoint()).toBe('compact');
  });

  it('defaults to regular / non-touch when nothing matches', () => {
    setupMatchMedia({});
    const service = TestBed.inject(LayoutService);
    expect(service.isCompact()).toBe(false);
    expect(service.isTouch()).toBe(false);
    expect(service.breakpoint()).toBe('regular');
  });

  it('updates isCompact and breakpoint when the media query changes', () => {
    setupMatchMedia({ [COMPACT_QUERY]: false });
    const service = TestBed.inject(LayoutService);
    expect(service.isCompact()).toBe(false);

    fireChange(COMPACT_QUERY, true);
    expect(service.isCompact()).toBe(true);
    expect(service.breakpoint()).toBe('compact');
  });

  it('updates isTouch when the pointer query changes', () => {
    setupMatchMedia({ [COARSE_QUERY]: false });
    const service = TestBed.inject(LayoutService);
    expect(service.isTouch()).toBe(false);

    fireChange(COARSE_QUERY, true);
    expect(service.isTouch()).toBe(true);
  });
});
