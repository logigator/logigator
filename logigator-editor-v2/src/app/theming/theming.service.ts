import { computed, Injectable, signal } from '@angular/core';
import { Theme, ThemeVariant } from './theme.model';
import { ThemeType } from './theme-type.enum';
import { DEFAULT_THEME, THEMES } from './themes';

const STORAGE_KEY = 'logigator.theme';
const VARIANTS: readonly ThemeType[] = [ThemeType.DARK, ThemeType.LIGHT];
const THEMES_BY_ID = new Map(THEMES.map((theme) => [theme.id, theme]));

@Injectable({
  providedIn: 'root'
})
export class ThemingService {
  private readonly _themeId = signal<string>(DEFAULT_THEME.id);
  private readonly _variant = signal<ThemeType>(ThemeType.DARK);

  // Snapshot-only override: forces the canvas to a canonical light/dark for
  // offscreen previews without touching the selection or the DOM. null = live.
  private readonly _override = signal<ThemeType | null>(null);

  public readonly themes = THEMES;
  public readonly activeTheme = computed<Theme>(
    () => THEMES_BY_ID.get(this._themeId()) ?? DEFAULT_THEME
  );
  /** The active dark/light variant (snapshot override wins). */
  public readonly currentThemeType = computed(
    () => this._override() ?? this._variant()
  );
  /**
   * The resolved canvas colors for the active theme + variant.
   *
   * The override branch is load-bearing: while a snapshot override is active it
   * resolves against DEFAULT_THEME, not the user's selection. That is what makes
   * server thumbnails (the only `setActiveThemeType` caller) always render in the
   * default theme, while the minimap and user image exports — which never
   * override — follow the current theme.
   */
  public readonly currentTheme = computed<ThemeVariant>(() =>
    this._resolve(
      this._override() ? DEFAULT_THEME : this.activeTheme(),
      this.currentThemeType()
    )
  );
  /** Cache key for the baked canvas graphics — distinct per theme + variant. */
  public readonly currentThemeKey = computed(() =>
    this._override()
      ? `canonical-${this._override()}`
      : `${this._themeId()}-${this._variant()}`
  );

  constructor() {
    this.loadTheme();
  }

  /** Switches the theme, keeping the current dark/light variant. */
  public setTheme(id: string): void {
    if (!THEMES_BY_ID.has(id)) return;
    this._themeId.set(id);
    this._commit();
  }

  /** Switches dark/light, keeping the current theme. */
  public setVariant(variant: ThemeType): void {
    this._variant.set(variant);
    this._commit();
  }

  public loadTheme(): void {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? this._parse(stored) : null;
    this._themeId.set(parsed?.id ?? DEFAULT_THEME.id);
    this._variant.set(parsed?.variant ?? ThemeType.DARK);
    this._commit();
  }

  /**
   * Overrides the active variant to a canonical light/dark, without the DOM /
   * localStorage / selection side effects of {@link setVariant}. For rendering
   * offscreen dual-theme snapshots; pair with {@link restoreActiveTheme}.
   */
  public setActiveThemeType(type: ThemeType): void {
    this._override.set(type);
  }

  /** Drops the snapshot override, restoring the live selection. */
  public restoreActiveTheme(): void {
    this._override.set(null);
  }

  private _commit(): void {
    this._override.set(null);
    const id = this._themeId();
    const variant = this._variant();
    const root = document.documentElement;
    for (const theme of THEMES) {
      for (const v of VARIANTS) root.classList.remove(`${theme.id}-${v}`);
    }
    root.classList.add(`${id}-${variant}`);
    root.classList.toggle('dark-mode', variant === ThemeType.DARK);
    localStorage.setItem(STORAGE_KEY, `${id}-${variant}`);
  }

  // DEFAULT_THEME (typed DefaultTheme) fills every field, so the merge is a
  // complete ThemeVariant with no cast.
  private _resolve(theme: Theme, variant: ThemeType): ThemeVariant {
    return { ...DEFAULT_THEME[variant], ...theme[variant] };
  }

  private _parse(value: string): { id: string; variant: ThemeType } | null {
    for (const variant of VARIANTS) {
      const suffix = `-${variant}`;
      if (value.endsWith(suffix)) {
        const id = value.slice(0, -suffix.length);
        if (THEMES_BY_ID.has(id)) return { id, variant };
      }
    }
    return null;
  }
}
