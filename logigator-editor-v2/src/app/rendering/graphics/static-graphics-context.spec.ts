import { describe, expect, it, vi } from 'vitest';
import { Graphics } from 'pixi.js';
import { StaticGraphicsContext } from './static-graphics-context';

class TestContext extends StaticGraphicsContext {
  constructor() {
    super();
    this.rect(0, 0, 1, 1).fill(0xffffff);
  }
}

describe('StaticGraphicsContext', () => {
  it('opts out of the renderer GC', () => {
    expect(new TestContext().autoGarbageCollect).toBe(false);
  });

  it('keeps the listener lists empty while Graphics attach and detach', () => {
    const first = new TestContext();
    const second = new TestContext();
    const graphics = new Graphics(first);

    graphics.context = second;
    graphics.context = first;

    for (const context of [first, second]) {
      expect(context.listenerCount('update')).toBe(0);
      expect(context.listenerCount('unload')).toBe(0);
    }
  });

  it('still swaps the context and dirties the view', () => {
    const graphics = new Graphics(new TestContext());
    const next = new TestContext();
    graphics.didViewUpdate = false;

    graphics.context = next;

    expect(graphics.context).toBe(next);
    expect(graphics.didViewUpdate).toBe(true);
  });

  it('delivers events other than update/unload', () => {
    const context = new TestContext();
    const onDestroy = vi.fn();
    const onceDestroy = vi.fn();
    context.on('destroy', onDestroy);
    context.once('destroy', onceDestroy);

    context.destroy();

    expect(onDestroy).toHaveBeenCalledTimes(1);
    expect(onceDestroy).toHaveBeenCalledTimes(1);
  });
});
