import { beforeEach, describe, expect, it } from 'vitest';
import { Point } from 'pixi.js';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { Direction } from '../../utils/direction';
import { rotatePointAroundPivot, rotationPivotFor } from '../../utils/rotation';
import { WireDirection } from '../../wires/wire-direction.enum';
import { makeAnd, makeWire } from '../../../testing/factories';
import { groupGridBounds, rotateElements } from './rotate-elements';

describe('rotateElements', () => {
  beforeEach(() => {
    configureTestBed();
  });

  it('orbits every component port exactly around the pivot, from any starting direction', () => {
    for (const startDirection of [
      Direction.E,
      Direction.S,
      Direction.W,
      Direction.N
    ]) {
      for (const steps of [1, 2, 3]) {
        const comp = makeAnd(3, startDirection, 7, -2);
        const pivot = new Point(3, 5);
        const oldPorts = comp.connectionPoints;

        rotateElements([comp], [], pivot, steps);

        const newPorts = comp.connectionPoints;
        expect(newPorts.length).toBe(oldPorts.length);
        for (let i = 0; i < oldPorts.length; i++) {
          expect(newPorts[i]).toEqual(
            rotatePointAroundPivot(pivot, oldPorts[i], steps)
          );
        }
        comp.destroy({ children: true });
      }
    }
  });

  it('keeps the direction option in sync so serialization reflects the turn', () => {
    const comp = makeAnd(2, Direction.E, 0, 0);
    rotateElements([comp], [], new Point(0, 0), 1);
    expect(comp.direction).toBe(Direction.S);
    expect(comp.options.direction.value).toBe(Direction.S);
    comp.destroy({ children: true });
  });

  it('orbits wire endpoints, swaps the axis and preserves the length', () => {
    // Horizontal wire (2.5, 4.5) → (7.5, 4.5).
    const wire = makeWire(2, 4, WireDirection.HORIZONTAL, 5);
    const pivot = new Point(5, 5);
    const [oldStart, oldEnd] = wire.connectionPoints;

    rotateElements([], [wire], pivot, 1);

    expect(wire.direction).toBe(WireDirection.VERTICAL);
    expect(wire.length).toBe(5);
    const [start, end] = wire.connectionPoints;
    // The rotated endpoints, re-normalized so start is the lesser one.
    const a = rotatePointAroundPivot(pivot, oldStart, 1);
    const b = rotatePointAroundPivot(pivot, oldEnd, 1);
    expect({ x: start.x, y: start.y }).toEqual({
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y)
    });
    expect({ x: end.x, y: end.y }).toEqual({
      x: Math.max(a.x, b.x),
      y: Math.max(a.y, b.y)
    });
    wire.destroy();
  });

  it('keeps a wire attached to the port it fed across a group turn', () => {
    // AND at (4, 0), inputs at (3.5, 0.5)/(3.5, 1.5); wire feeding the first
    // input from the left.
    const comp = makeAnd(2, Direction.E, 4, 0);
    const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 3);
    const [, wireEnd] = wire.connectionPoints;
    expect(wireEnd).toEqual(comp.connectionPoints[0]);

    const bounds = groupGridBounds([comp], [wire]);
    rotateElements([comp], [wire], rotationPivotFor(bounds!), 1);

    const [start, end] = wire.connectionPoints;
    const stillTouching =
      comp.connectionPoints.some((p) => p.x === start.x && p.y === start.y) ||
      comp.connectionPoints.some((p) => p.x === end.x && p.y === end.y);
    expect(stillTouching).toBe(true);

    comp.destroy({ children: true });
    wire.destroy();
  });
});
