/**
 * One entry of an {@link LgNavigation} tree. Pure data — unlike `MenuItem`
 * there are no command callbacks; activating a leaf updates the navigation's
 * `selected` model instead.
 */
export interface NavigationItem {
  /** Unique id among all items; leaves report it through `selected`. */
  id: string;
  label: string;
  /** Icon class rendered before the label (e.g. `ph ph-book-open`). */
  icon?: string;
  /** Child items; presence makes this a collapsible group header. */
  items?: readonly NavigationItem[];
}
