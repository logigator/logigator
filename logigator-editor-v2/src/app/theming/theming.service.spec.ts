import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { ThemingService } from './theming.service';
import { ThemeType } from './theme-type.enum';
import { DEFAULT_THEME, THEMES } from './themes';

const STORAGE_KEY = 'logigator.theme';
const THEME_CLASSES = THEMES.flatMap((t) => [`${t.id}-dark`, `${t.id}-light`]);

function activeThemeClasses(): string[] {
  return THEME_CLASSES.filter((c) =>
    document.documentElement.classList.contains(c)
  );
}

describe('ThemingService', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    document.documentElement.classList.remove('dark-mode', ...THEME_CLASSES);
    configureTestBed();
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark-mode', ...THEME_CLASSES);
  });

  it('defaults to the classic dark theme when nothing is stored', () => {
    const service = TestBed.inject(ThemingService);

    expect(service.activeTheme().id).toBe(DEFAULT_THEME.id);
    expect(service.currentThemeType()).toBe(ThemeType.DARK);
    expect(service.currentTheme().background).toBe(0x222526);
    expect(service.currentThemeKey()).toBe('classic-dark');
    expect(activeThemeClasses()).toEqual(['classic-dark']);
    expect(document.documentElement.classList.contains('dark-mode')).toBe(true);
  });

  it('merges a theme variant over the default (only overridden fields differ)', () => {
    const service = TestBed.inject(ThemingService);

    service.setTheme('carbon'); // overrides only `background`
    const carbon = service.currentTheme();
    expect(carbon.background).toBe(0x1a1f27);
    // Every other field falls back to the classic dark variant.
    expect(carbon.wire).toBe(DEFAULT_THEME.dark.wire);
    expect(carbon.grid).toBe(DEFAULT_THEME.dark.grid);
  });

  it('gives same-variant themes distinct board colors and cache keys', () => {
    const service = TestBed.inject(ThemingService);

    service.setTheme('carbon');
    expect(service.currentTheme().background).toBe(0x1a1f27);
    expect(service.currentThemeKey()).toBe('carbon-dark');

    service.setTheme('void');
    expect(service.currentThemeType()).toBe(ThemeType.DARK);
    expect(service.currentTheme().background).toBe(0x000000);
    expect(service.currentThemeKey()).toBe('void-dark');
  });

  it('setVariant keeps the theme; setTheme keeps the variant', () => {
    const service = TestBed.inject(ThemingService);

    service.setTheme('carbon');
    service.setVariant(ThemeType.LIGHT);
    expect(service.activeTheme().id).toBe('carbon');
    expect(service.currentThemeType()).toBe(ThemeType.LIGHT);
    expect(service.currentTheme().background).toBe(0xe9eef6);
    expect(activeThemeClasses()).toEqual(['carbon-light']);
    expect(document.documentElement.classList.contains('dark-mode')).toBe(
      false
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe('carbon-light');

    service.setTheme('mocha');
    expect(service.activeTheme().id).toBe('mocha');
    expect(service.currentThemeType()).toBe(ThemeType.LIGHT);
    expect(service.currentTheme().background).toBe(0xf3ece1);
    expect(activeThemeClasses()).toEqual(['mocha-light']);
  });

  it('applies exactly one theme class at a time', () => {
    const service = TestBed.inject(ThemingService);

    service.setTheme('void');
    expect(activeThemeClasses()).toEqual(['void-dark']);

    service.setTheme('classic');
    expect(activeThemeClasses()).toEqual(['classic-dark']);
  });

  it('ignores an unknown theme id', () => {
    const service = TestBed.inject(ThemingService);
    service.setTheme('carbon');

    service.setTheme('does-not-exist');

    expect(service.activeTheme().id).toBe('carbon');
  });

  it('restores a persisted selection', () => {
    localStorage.setItem(STORAGE_KEY, 'void-light');
    const service = TestBed.inject(ThemingService);

    expect(service.activeTheme().id).toBe('void');
    expect(service.currentThemeType()).toBe(ThemeType.LIGHT);
  });

  it('falls back to the default for an unrecognized stored value', () => {
    localStorage.setItem(STORAGE_KEY, 'not-a-theme');
    const service = TestBed.inject(ThemingService);

    expect(service.activeTheme().id).toBe(DEFAULT_THEME.id);
    expect(service.currentThemeType()).toBe(ThemeType.DARK);
  });

  it('setActiveThemeType overrides to a canonical canvas; restore returns to the selection', () => {
    const service = TestBed.inject(ThemingService);
    service.setTheme('carbon'); // dark, board 0x1a1f27

    service.setActiveThemeType(ThemeType.LIGHT);

    // Canvas swapped to the canonical (classic) light theme for a preview.
    expect(service.currentThemeType()).toBe(ThemeType.LIGHT);
    expect(service.currentTheme().background).toBe(0xf5f5f5);
    expect(service.currentThemeKey()).toBe('canonical-light');
    // Selection, DOM class and persisted value are untouched.
    expect(service.activeTheme().id).toBe('carbon');
    expect(activeThemeClasses()).toEqual(['carbon-dark']);
    expect(document.documentElement.classList.contains('dark-mode')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('carbon-dark');

    service.restoreActiveTheme();

    expect(service.currentThemeType()).toBe(ThemeType.DARK);
    expect(service.currentTheme().background).toBe(0x1a1f27);
    expect(service.currentThemeKey()).toBe('carbon-dark');
  });
});
