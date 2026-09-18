import { ListKeyManager, ListKeyManagerOption } from '@angular/cdk/a11y';
import { QueryList } from '@angular/core';

/** Options for {@link createListKeyManager}. */
export interface ListKeyManagerOptions {
  /** Arrow-key axis. Defaults to `'vertical'`. */
  orientation?: 'vertical' | 'horizontal';
  wrap?: boolean;
  homeAndEnd?: boolean;
  /** Type-ahead search; pass a number to override the debounce (ms). */
  typeAhead?: boolean | number;
}

/**
 * A configured `cdk/a11y` `ListKeyManager`, centralizing the builder chain so
 * every consumer applies the same options the same way.
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
  if (options.typeAhead === true || typeof options.typeAhead === 'number') {
    manager.withTypeAhead(
      typeof options.typeAhead === 'number' ? options.typeAhead : undefined
    );
  }

  return manager;
}
