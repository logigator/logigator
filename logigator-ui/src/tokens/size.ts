/**
 * Component size. Only `'small'` and the default exist across the editor today;
 * a component with no `size` (or `undefined`) renders at its default size.
 *
 * Kept as a string union so further sizes can be added later without reworking
 * call sites.
 */
export type LgSize = 'small';
