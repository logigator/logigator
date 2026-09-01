/**
 * The chrome's text-link skins. Plain class strings rather than a component:
 * these are inline links in running chrome, not controls; a button-shaped
 * anchor is `<a lgButton>` instead.
 */

/** A top-level navigation link in the header. */
export const NAV_LINK_CLASS =
  'rounded px-3 py-2 text-sm text-text transition-colors hover:bg-content-hover';

/** A row inside a popover or the navigation drawer. */
export const MENU_LINK_CLASS =
  'block rounded px-3 py-2 text-sm text-text transition-colors hover:bg-content-hover';
