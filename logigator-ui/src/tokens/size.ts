/**
 * A four-step scale shared by every sized control. An omitted `size` renders
 * identically to `size="md"`.
 */
export type LgSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Inner padding for a text-bearing control, keyed by size, so every sized
 * control pads identically. `text-*` is bundled in so each step scales its
 * type too.
 */
export const CONTROL_PADDING_SM = 'px-2.5 py-1.5 text-sm';
export const CONTROL_PADDING_MD = 'px-3 py-2 text-base';
export const CONTROL_PADDING_LG = 'px-4 py-2.5 text-lg';
export const CONTROL_PADDING_XL = 'px-5 py-3 text-xl';

export function controlPadding(size: LgSize | undefined): string {
  switch (size) {
    case 'sm':
      return CONTROL_PADDING_SM;
    case 'lg':
      return CONTROL_PADDING_LG;
    case 'xl':
      return CONTROL_PADDING_XL;
    default:
      return CONTROL_PADDING_MD;
  }
}
