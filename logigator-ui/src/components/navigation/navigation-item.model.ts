/**
 * One entry of an {@link LgNavigation} tree. Pure data: activating a leaf
 * updates the navigation's `selected` model rather than running a command.
 */
export interface NavigationItem {
  /** Unique id among all items; leaves report it through `selected`. */
  id: string;
  label: string;
  icon?: string;
  /** Child items; presence makes this a collapsible group header. */
  items?: readonly NavigationItem[];
}
