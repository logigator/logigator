import { DefaultTheme, Theme } from '../theme.model';
import { ClassicTheme } from './classic.theme';
import { CarbonTheme } from './carbon.theme';
import { MochaTheme } from './mocha.theme';
import { VoidTheme } from './void.theme';

/** Fills every {@link ThemeVariant} field; selected by default; base for merges. */
export const DEFAULT_THEME: DefaultTheme = ClassicTheme;

/** Registry order = switcher order. Classic (the default) is first. */
export const THEMES: readonly Theme[] = [
  ClassicTheme,
  CarbonTheme,
  MochaTheme,
  VoidTheme
];
