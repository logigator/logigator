import { ListKeyManager, ListKeyManagerOption } from '@angular/cdk/a11y';
import { QueryList } from '@angular/core';

/**
 * Options for {@link createListKeyManager}. Mirrors the `cdk/a11y`
 * `ListKeyManager` builder chain the library's keyboard-navigable surfaces
 * (Tabs, menus, Select) all configure the same way.
 */
export interface ListKeyManagerOptions {
  /** Arrow-key axis. Defaults to `'vertical'`. */
  orientation?: 'vertical' | 'horizontal';
  /** Wrap from last item back to first (and vice-versa). */
  wrap?: boolean;
  /** Handle Home/End to jump to the first/last item. */
  homeAndEnd?: boolean;
  /** Type-ahead search; pass a number to override the debounce (ms). */
  typeAhead?: boolean | number;
}

/**
 * Create a configured `cdk/a11y` `ListKeyManager` over a set of focusable /
 * highlightable items. Centralizes the builder chain so every consumer applies
 * the same options the same way.
 */
export function createListKeyManager<T extends ListKeyManagerOption>(
  items: QueryList<T> | T[],
  options: ListKeyManagerOptions = {}
): ListKeyManager<T> {
  const manager = new ListKeyManager<T>(items);

  if (options.orientation === 'horizontal') {
    manager.withHorizontalOrientation('ltr');
  } else {
    manager.withVerticalOrientation(true);
  }
  if (options.wrap) {
    manager.withWrap();
  }
  if (options.homeAndEnd) {
    manager.withHomeAndEnd();
  }
  if (options.typeAhead) {
    manager.withTypeAhead(
      typeof options.typeAhead === 'number' ? options.typeAhead : undefined
    );
  }

  return manager;
}
