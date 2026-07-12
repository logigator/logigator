import { MenuItem, MenuItemCommandEvent } from '@logigator/ui';

/**
 * Clones a menu model so every leaf command also runs `close` first — a sheet
 * dismisses itself on action, and a dialog the action opens lands on an
 * uncovered board.
 */
export function withSheetClose(
  items: MenuItem[],
  close: () => void
): MenuItem[] {
  return items.map((item) => ({
    ...item,
    items: item.items && withSheetClose(item.items, close),
    command:
      item.command &&
      ((event: MenuItemCommandEvent) => {
        close();
        item.command!(event);
      })
  }));
}
