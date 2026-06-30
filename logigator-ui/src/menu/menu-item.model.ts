/**
 * The menu model shared by PanelMenu (and, later, Menubar/Menu). A deliberate
 * structural subset of PrimeNG's `MenuItem` so the editor's existing
 * `MenuItem[]` builders keep type-checking against it during the migration.
 *
 * `command`'s parameter is required (not optional) on purpose: that makes a
 * PrimeNG `MenuItem` assignable to this one regardless of whether PrimeNG types
 * its own command parameter as required or optional.
 */
export interface MenuItemCommandEvent {
  originalEvent?: Event;
  item?: MenuItem;
  index?: number;
}

export interface MenuItem {
  label?: string;
  icon?: string;
  command?: (event: MenuItemCommandEvent) => void;
  items?: MenuItem[];
  separator?: boolean;
  disabled?: boolean;
  visible?: boolean;
  styleClass?: string;
  /**
   * Opaque per-item metadata the library carries but never renders itself — a
   * consumer reads it in its own `#item` template (e.g. the editor stores a
   * keyboard-binding object here and renders it via a custom shortcut display).
   * Typed `unknown` so consumers attach whatever shape they need.
   */
  shortcut?: unknown;
  expanded?: boolean;
}
