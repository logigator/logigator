import { DefaultTheme } from '../theme.model';

/**
 * The default theme — supplies every {@link ThemeVariant} field for both
 * variants, so the merge for any other theme is always complete. Its `--lg-*`
 * palette is the base @logigator/ui one (theme.css `:root` / `.dark-mode`), so
 * `classic` needs no preset CSS file.
 */
export const ClassicTheme: DefaultTheme = {
  id: 'classic',
  label: 'Classic',
  dark: {
    background: 0x222526,
    grid: 0x1c8045,
    wire: 0x27ae60,
    selectRect: 0,
    selectTint: 0x8a8a8a,
    wireSelectColor: 0x0f5e36,
    fontTint: 0xffffff,
    ledOn: 0x27ae60,
    ledOff: 0x18592d
  },
  light: {
    background: 0xf5f5f5,
    grid: 0x000000,
    wire: 0x000000,
    selectRect: 0,
    selectTint: 0xd0d0d0,
    wireSelectColor: 0x909090,
    fontTint: 0x000000,
    ledOn: 0x27ae60,
    ledOff: 0x000000
  }
};
