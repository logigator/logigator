import { describe, expect, it, vi } from 'vitest';
import {
  buildCircle,
  Circle,
  Graphics,
  GraphicsContext,
  Rectangle
} from 'pixi.js';
import { StaticGraphicsContext } from './static-graphics-context';
import { environment } from '../../../environments/environment';
import {
  ZOOM_STEP_BASE,
  ZOOM_STEP_MAX
} from '../../project/viewport-controller';

class TestContext extends StaticGraphicsContext {
  constructor() {
    super();
    this.rect(0, 0, 1, 1).fill(0xffffff);
  }
}

class CircleContext extends StaticGraphicsContext {
  constructor(radius: number) {
    super();
    this.smoothCircle(0.5, 0.5, radius).fill(0xffffff);
    this.rect(0, 0, 1, 1).fill(0xffffff);
  }
}

/** Each primitive's baked outline, transform applied, as flat x/y pairs. */
function bakedOutlines(context: GraphicsContext): number[][] {
  return context.instructions.flatMap((instruction) =>
    instruction.action === 'fill' || instruction.action === 'stroke'
      ? instruction.data.path.shapePath.shapePrimitives.map(
          ({ shape, transform }) => {
            const points: number[] = [];
            if (shape instanceof Circle) {
              buildCircle.build(shape, points);
            } else if (shape instanceof Rectangle) {
              points.push(shape.left, shape.top, shape.right, shape.bottom);
            }
            if (transform) {
              for (let i = 0; i < points.length; i += 2) {
                const p = transform.apply({ x: points[i], y: points[i + 1] });
                points[i] = p.x;
                points[i + 1] = p.y;
              }
            }
            return points;
          }
        )
      : []
  );
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

  describe('smoothCircle', () => {
    // Device pixels per grid unit at the deepest zoom on a 2× display.
    const MAX_PX_PER_UNIT =
      environment.gridSize * ZOOM_STEP_BASE ** ZOOM_STEP_MAX * 2;

    it.each([0.3125, 0.5])(
      'bakes a radius-%s outline within a quarter pixel of the true circle at max zoom',
      (radius) => {
        const [outline] = bakedOutlines(new CircleContext(radius));
        let worst = 0;
        for (let i = 0; i < outline.length; i += 2) {
          const x = outline[i];
          const y = outline[i + 1];
          const nx = outline[(i + 2) % outline.length];
          const ny = outline[(i + 3) % outline.length];
          expect(Math.hypot(x - 0.5, y - 0.5)).toBeCloseTo(radius, 9);
          const mid = Math.hypot((x + nx) / 2 - 0.5, (y + ny) / 2 - 0.5);
          worst = Math.max(worst, (radius - mid) * MAX_PX_PER_UNIT);
        }
        expect(worst).toBeLessThan(0.25);
      }
    );

    it('scopes its counter-scale to the circle', () => {
      const [, rect] = bakedOutlines(new CircleContext(0.5));
      expect(rect).toEqual([0, 0, 1, 1]);
    });
  });
});
