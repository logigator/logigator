import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import {
  DEFAULT_GAMEPAD_BINDINGS,
  GAMEPAD_KEYS_STORAGE_KEY,
  GamepadBindingsService
} from './gamepad-bindings.service';

function store(value: unknown): void {
  localStorage.setItem(
    GAMEPAD_KEYS_STORAGE_KEY,
    typeof value === 'string' ? value : JSON.stringify(value)
  );
}

function freshService(): GamepadBindingsService {
  TestBed.resetTestingModule();
  configureTestBed();
  return TestBed.inject(GamepadBindingsService);
}

describe('GamepadBindingsService', () => {
  beforeEach(() => {
    localStorage.removeItem(GAMEPAD_KEYS_STORAGE_KEY);
  });

  describe('reading storage', () => {
    it('falls back to the defaults for unparseable JSON', () => {
      store('{not json');
      expect(freshService().bindings()).toEqual(DEFAULT_GAMEPAD_BINDINGS);
    });

    it('ignores a record of another version entirely', () => {
      store({ v: 2, keys: { a: 'KeyP' } });
      expect(freshService().bindings()).toEqual(DEFAULT_GAMEPAD_BINDINGS);
    });

    it('replaces only the invalid entries with their defaults', () => {
      store({
        v: 1,
        keys: {
          a: 'KeyP',
          b: 42,
          start: null,
          x: 'Escape',
          turbo: 'KeyT'
        }
      });
      const bindings = freshService().bindings();

      expect(bindings).toEqual({
        ...DEFAULT_GAMEPAD_BINDINGS,
        a: 'KeyP',
        start: null
      });
      expect(Object.keys(bindings)).not.toContain('turbo');
    });

    it('never lets two controls share a code', () => {
      // `y` stores `a`'s default; `a`'s invalid entry then falls back onto it.
      store({ v: 1, keys: { a: 7, y: 'KeyX' } });
      const service = freshService();

      expect(service.bindings().a).toBe('KeyX');
      expect(service.bindings().y).toBeNull();
      expect(service.controlFor('KeyX')).toBe('a');
    });
  });

  describe('assign', () => {
    let service: GamepadBindingsService;

    beforeEach(() => {
      service = freshService();
    });

    it('swaps with the control that held the code and reports it', () => {
      const moved = service.assign('a', 'KeyZ');

      expect(moved).toBe('b');
      expect(service.bindings().a).toBe('KeyZ');
      expect(service.bindings().b).toBe('KeyX');
      expect(service.controlFor('KeyZ')).toBe('a');
      expect(service.controlFor('KeyX')).toBe('b');
    });

    it('hands an unbound control nothing when it takes its code away', () => {
      service.clear('a');
      service.assign('a', 'KeyZ');

      expect(service.bindings().b).toBeNull();
      expect(service.controlFor('KeyZ')).toBe('a');
    });

    it.each(['Escape', 'Tab'])('refuses %s', (code) => {
      expect(service.assign('a', code)).toBeNull();
      expect(service.bindings()).toEqual(DEFAULT_GAMEPAD_BINDINGS);
      expect(service.controlFor(code)).toBeNull();
    });
  });

  it('hands a fresh service what another instance wrote', () => {
    const first = freshService();
    first.assign('start', 'Space');
    first.clear('select');

    const second = freshService();
    expect(second.bindings().start).toBe('Space');
    expect(second.bindings().select).toBeNull();
    expect(second.controlFor('Enter')).toBeNull();
  });

  it('re-reads the bindings on a storage event for its key', () => {
    const service = freshService();
    store({ v: 1, keys: { up: 'KeyI' } });

    window.dispatchEvent(
      new StorageEvent('storage', { key: GAMEPAD_KEYS_STORAGE_KEY })
    );

    expect(service.bindings().up).toBe('KeyI');
    expect(service.controlFor('KeyI')).toBe('up');
  });

  it('reset restores and persists the defaults', () => {
    const service = freshService();
    service.assign('a', 'KeyP');
    service.reset();

    expect(freshService().bindings()).toEqual(DEFAULT_GAMEPAD_BINDINGS);
  });
});
