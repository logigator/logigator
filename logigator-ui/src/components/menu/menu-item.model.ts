import { LgShortcutBinding } from '../shortcut/shortcut';

export interface MenuItemCommandEvent {
  originalEvent?: Event;
  item?: MenuItem;
  index?: number;
}

export interface MenuItem {
  label?: string;
  icon?: string;
  /**
   * Makes the row a real link: it renders as an `<a>`, so it opens in a new
   * tab on a middle click, a modified click or from the context menu. A plain
   * click runs `command` in place of the browser's navigation when there is
   * one — how a consumer routes in-app — and follows the link when there is
   * not.
   */
  href?: string;
  /**
   * Where a link row opens, as the anchor's `target` — `_blank` for a page of
   * another app. It applies whenever the browser follows the link, which for a
   * row with a `command` is only a modified click.
   */
  target?: string;
  command?: (event: MenuItemCommandEvent) => void;
  items?: MenuItem[];
  separator?: boolean;
  disabled?: boolean;
  visible?: boolean;
  /**
   * Classes for the row's content in the default chrome — `text-error` for a
   * destructive row. They sit inside the row rather than on it, where a colour
   * would compete with the row's own `text-text` and lose to stylesheet order.
   * A custom `#item` template applies them itself.
   */
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
  'disabled:pointer-events-none disabled:opacity-50 ' +
  'aria-disabled:pointer-events-none aria-disabled:opacity-50';

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

/**
 * Whether a click on a row runs its `command`. A button row always does. A
 * link row does only for a plain primary click with a `command` to run, and
 * then the browser's navigation is cancelled; every other click — modified,
 * or on a row with nothing to run — is the browser's to follow.
 */
export function claimMenuItemClick(item: MenuItem, event: MouseEvent): boolean {
  if (!item.href) {
    return true;
  }
  if (
    !item.command ||
    event.button !== 0 ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return false;
  }
  event.preventDefault();
  return true;
}

/** Selects the rows keyboard focus roves over: every enabled item. */
export const ENABLED_MENU_ITEM_SELECTOR =
  '[role=menuitem]:not([disabled]):not([aria-disabled=true])';
