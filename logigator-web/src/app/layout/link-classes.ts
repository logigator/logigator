/**
 * The chrome's link skins. Plain class strings rather than a component: these
 * are anchors, and wrapping a real `<a>` in a button-shaped component is what
 * produces the nested-interactive markup the accessibility rules reject.
 */

/** A top-level navigation link in the header. */
export const NAV_LINK_CLASS =
  'rounded px-3 py-2 text-sm text-text transition-colors hover:bg-content-hover';

/** A row inside a popover or the navigation drawer. */
export const MENU_LINK_CLASS =
  'block rounded px-3 py-2 text-sm text-text transition-colors hover:bg-content-hover';

/** An anchor styled as the header's primary call to action. */
export const BUTTON_LINK_CLASS =
  'inline-flex items-center justify-center rounded-md border border-transparent ' +
  'bg-primary px-3 py-1.5 text-sm font-medium text-primary-contrast ' +
  'transition-colors hover:bg-primary-emphasis';

/** An anchor styled as the header's secondary call to action. */
export const BUTTON_LINK_OUTLINED_CLASS =
  'inline-flex items-center justify-center rounded-md border border-primary-200 ' +
  'px-3 py-1.5 text-sm font-medium text-primary transition-colors ' +
  'hover:bg-primary-50 dark:border-primary-700 dark:hover:bg-primary/8';
