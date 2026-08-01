import { beforeEach, describe, expect, it } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { setStaticDIInjector } from '../utils/get-di';
import { EditorSettingsService } from '../settings/editor-settings.service';
import { ThemingService } from '../theming/theming.service';
import { TranslationService } from '../translation/translation.service';
import { AutomationApiService } from './automation-api.service';

describe('AutomationApiService settings', () => {
  let api: AutomationApiService;
  let settings: EditorSettingsService;
  let theming: ThemingService;

  beforeEach(() => {
    configureTestBed();
    setStaticDIInjector(TestBed.inject(Injector));
    api = TestBed.inject(AutomationApiService);
    settings = TestBed.inject(EditorSettingsService);
    theming = TestBed.inject(ThemingService);
  });

  it('describes every registered preference without a hand-written list', () => {
    const described = api.settingsDescribe();
    for (const setting of settings.settings) {
      expect(described).toContainEqual(
        expect.objectContaining({ key: setting.key, kind: 'boolean' })
      );
    }
    expect(described).toContainEqual(
      expect.objectContaining({ key: 'theme', values: theming.availableThemes })
    );
    // Every boolean plus the two enums.
    expect(described.length).toBe(settings.settings.length + 2);
  });

  it('reads back the live preference values', () => {
    settings.showGrid.set(false);
    const state = api.settingsGet();
    expect(state['showGrid']).toBe(false);
    expect(state.theme).toBe(theming.currentThemeType());
    expect(state.language).toBe(
      TestBed.inject(TranslationService).getActiveLang()
    );
  });

  it('applies a patch through the same services the UI writes to', () => {
    const state = api.settingsSet({ theme: 'light', fpsCounter: true });
    expect(state.theme).toBe('light');
    expect(theming.currentThemeType()).toBe('light');
    expect(settings.fpsCounter.value()).toBe(true);
    expect(document.documentElement.classList.contains('dark-mode')).toBe(
      false
    );
  });

  it('validates the language against the available list', () => {
    const langs = TestBed.inject(TranslationService).getAvailableLangs();
    const ids = langs.map((l) => (typeof l === 'string' ? l : l.id));
    expect(api.settingsSet({ language: ids[0] }).language).toBe(ids[0]);
    expect(() => api.settingsSet({ language: 'klingon' })).toThrow(/language/);
  });

  it('applies nothing when any key in the patch is bad', () => {
    const before = api.settingsGet();
    expect(() => api.settingsSet({ showGrid: false, nonsense: true })).toThrow(
      /unknown setting "nonsense"/
    );
    expect(api.settingsGet()).toEqual(before);

    expect(() =>
      api.settingsSet({ showGrid: 'yes' as unknown as boolean })
    ).toThrow(/expects a boolean/);
    expect(api.settingsGet()).toEqual(before);
  });

  it('rejects a theme outside the registered set', () => {
    expect(() => api.settingsSet({ theme: 'neon' })).toThrow(/theme must be/);
  });
});
