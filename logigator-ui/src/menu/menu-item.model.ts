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
  shortcut?: string;
  expanded?: boolean;
}
