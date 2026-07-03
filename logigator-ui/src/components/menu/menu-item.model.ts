import { LgShortcutBinding } from '../shortcut/shortcut';

/**
 * The menu model shared by the menu surfaces. A structural subset of PrimeNG's
 * `MenuItem`, so a PrimeNG `MenuItem[]` is assignable to it.
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
   * The item's key binding. The Menubar's default rows render it as
   * {@link LgShortcut} chips; a custom `#item` template reads it itself.
   */
  shortcut?: LgShortcutBinding | null;
  expanded?: boolean;
}

/** The interactive wrapper for one menu / submenu row; chrome fills it. */
export const MENU_ITEM_CLASS =
  'flex w-full rounded text-left text-text hover:bg-content-hover ' +
  'focus:outline-none focus-visible:bg-content-hover ' +
  'disabled:pointer-events-none disabled:opacity-50';
