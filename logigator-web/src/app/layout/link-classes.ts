/**
 * The chrome's text-link skins. Plain class strings rather than a component:
 * these are inline links in running chrome, not controls; a button-shaped
 * anchor is `<a lgButton>` instead.
 */

/**
 * A top-level navigation link in the bar. The bar is the same green in both
 * schemes, so its links take their ink from it and wash black on hover rather
 * than reaching for a scheme-following token.
 */
export const BAR_LINK_CLASS =
  'rounded px-3 py-2 text-sm transition-colors hover:bg-black/10';

/** The bar link for the page currently open. */
export const BAR_LINK_ACTIVE_CLASS = 'bg-black/10 font-semibold';

/** A row inside a popover or the navigation drawer, both on `bg-content`. */
export const MENU_LINK_CLASS =
  'block rounded px-3 py-2 text-sm text-text transition-colors hover:bg-content-hover';
