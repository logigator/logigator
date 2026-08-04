import { describe, expect, it } from 'vitest';
import { ListKeyManagerOption } from '@angular/cdk/a11y';
import { createListKeyManager } from './key-manager';

class Item implements ListKeyManagerOption {
  constructor(
    private readonly label: string,
    public disabled = false
  ) {}
  getLabel(): string {
    return this.label;
  }
}

describe('createListKeyManager', () => {
  it('navigates next/previous', () => {
    const mgr = createListKeyManager([
      new Item('a'),
      new Item('b'),
      new Item('c')
    ]);
    mgr.setFirstItemActive();
    expect(mgr.activeItemIndex).toBe(0);
    mgr.setNextItemActive();
    expect(mgr.activeItemIndex).toBe(1);
    mgr.setPreviousItemActive();
    expect(mgr.activeItemIndex).toBe(0);
  });

  it('skips disabled items', () => {
    const mgr = createListKeyManager([
      new Item('a'),
      new Item('b', true),
      new Item('c')
    ]);
    mgr.setFirstItemActive();
    mgr.setNextItemActive();
    expect(mgr.activeItemIndex).toBe(2);
  });

  it('wraps only when configured', () => {
    const items = [new Item('a'), new Item('b'), new Item('c')];
    const wrapped = createListKeyManager(items, { wrap: true });
    wrapped.setActiveItem(2);
    wrapped.setNextItemActive();
    expect(wrapped.activeItemIndex).toBe(0);

    const clamped = createListKeyManager(items);
    clamped.setActiveItem(2);
    clamped.setNextItemActive();
    expect(clamped.activeItemIndex).toBe(2);
  });
});
