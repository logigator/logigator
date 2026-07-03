/**
 * Component size. Only `'small'` and the default exist across the editor today;
 * a component with no `size` (or `undefined`) renders at its default size.
 *
 * Kept as a string union so further sizes can be added later without reworking
 * call sites.
 */
export type LgSize = 'small';

/**
 * Inner padding for a text-bearing control (Button, SelectButton, InputNumber,
 * and the form fields), keyed by size. The single source of truth so every
 * sized control pads identically; `text-*` is bundled in so the small variant
 * also shrinks its type.
 */
export const CONTROL_PADDING = 'px-3 py-2 text-base';
export const CONTROL_PADDING_SMALL = 'px-2.5 py-1.5 text-sm';

/** Resolve the padding class for a control of the given size. */
export function controlPadding(size: LgSize | undefined): string {
  return size === 'small' ? CONTROL_PADDING_SMALL : CONTROL_PADDING;
}
