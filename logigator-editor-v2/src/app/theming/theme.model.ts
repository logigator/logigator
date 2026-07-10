/** The canvas colors a theme variant paints (board, grid, wires, LEDs, text). */
export interface ThemeVariant {
  background: number;
  grid: number;
  wire: number;
  selectRect: number;
  selectTint: number;
  wireSelectColor: number;
  fontTint: number;
  ledOn: number;
  ledOff: number;
}

/**
 * A selectable theme, with a dark and a light variant. Applied to `<html>` as
 * the CSS class `${id}-dark` / `${id}-light` (which selects the `--lg-*`
 * palette), and its matching variant supplies the canvas colors.
 *
 * The default theme (see `themes/`) fills every {@link ThemeVariant} field for
 * both variants; every other theme lists only the fields it overrides, which
 * are merged over the default.
 */
export interface Theme {
  id: string;
  label: string;
  dark: Partial<ThemeVariant>;
  light: Partial<ThemeVariant>;
}

export type DefaultTheme = Theme & {
  dark: ThemeVariant;
  light: ThemeVariant;
};
