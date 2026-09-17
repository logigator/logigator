import { LgShortcutBinding } from '../shortcut/shortcut';

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

/**
 * The popup panel's chrome, shared by `LgMenu` and `LgMenubar`'s submenus.
 * The height clamp is measured off the viewport, not off the pane: when cdk
 * pushes an overlay into place it caps the pane at the *viewport* rather than
 * at the space beside the anchor, so a panel that only scrolled would hang its
 * last rows off the bottom of the window with no way to reach them. Menus hang
 * from the title bar, so what is left under it is the viewport less its height.
 */
export const MENU_PANEL_CLASS =
  'min-w-48 rounded-md border border-border bg-content p-1 shadow-md ' +
  'focus:outline-none max-h-[calc(100dvh-5rem)] overflow-y-auto';
