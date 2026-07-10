import { Theme } from '../theme.model';

/** True-black OLED dark / pure-white light. Overrides only the board color. */
export const VoidTheme: Theme = {
  id: 'void',
  label: 'Void',
  dark: { background: 0x000000 },
  light: { background: 0xffffff }
};
