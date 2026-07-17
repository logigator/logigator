import { describe, expect, it } from 'vitest';
import { Point } from 'pixi.js';
import { Direction } from '../utils/direction';
import {
  bodyGridBounds,
  ComponentShape,
  connectionPoints,
  gridBounds,
  negationBubbleAnchor,
  rotatedLocalPoint
} from './component-geometry';

function shape(overrides: Partial<ComponentShape> = {}): ComponentShape {
  return {
    direction: Direction.E,
    numInputs: 2,
    numOutputs: 1,
    bodyGridWidth: 2,
    bodyGridHeight: 2,
    position: new Point(10, 20),
    ...overrides
  };
}

const ALL_DIRECTIONS = [
  Direction.E,
  Direction.S,
  Direction.W,
  Direction.N
] as const;

describe('component geometry lattice exactness', () => {
  it('every connection point lands exactly on the half-grid lattice in all four directions', () => {
    for (const direction of ALL_DIRECTIONS) {
      for (const p of connectionPoints(shape({ direction }))) {
        // Strict equality against the lattice — no epsilon. A trig rotation
        // would fail this with ~1e-16 drift.
        expect((p.x * 2) % 1).toBe(0);
        expect((p.y * 2) % 1).toBe(0);
      }
    }
  });

  it('rotatedLocalPoint carries no float noise near the origin', () => {
    // The regression a trig Matrix introduces: rotating (0, 0.5) by 90°
    // yields -0.5 ± 1e-16, which survives the final addition for components
    // near the origin and breaks exact-coordinate port matching.
    expect(rotatedLocalPoint(Direction.S, 0, 0.5)).toMatchObject({
      x: -0.5,
      y: 0
    });
    expect(rotatedLocalPoint(Direction.W, -0.5, 0.5)).toMatchObject({
      x: 0.5,
      y: -0.5
    });
    expect(rotatedLocalPoint(Direction.N, -0.5, 0.5)).toMatchObject({
      x: 0.5,
      y: 0.5
    });
  });
});

describe('connectionPoints', () => {
  it('places E-facing inputs at the left stub tips and outputs past the body', () => {
    const points = connectionPoints(shape());
    expect(points).toEqual([
      new Point(9.5, 20.5),
      new Point(9.5, 21.5),
      new Point(12.5, 20.5)
    ]);
  });

  it('rotates ports exactly per direction (S: +x → +y)', () => {
    const points = connectionPoints(shape({ direction: Direction.S }));
    expect(points).toEqual([
      new Point(9.5, 19.5),
      new Point(8.5, 19.5),
      new Point(9.5, 22.5)
    ]);
  });

  it('mirrors ports for W and N', () => {
    expect(connectionPoints(shape({ direction: Direction.W }))).toEqual([
      new Point(10.5, 19.5),
      new Point(10.5, 18.5),
      new Point(7.5, 19.5)
    ]);
    expect(connectionPoints(shape({ direction: Direction.N }))).toEqual([
      new Point(10.5, 20.5),
      new Point(11.5, 20.5),
      new Point(10.5, 17.5)
    ]);
  });
});

describe('bounds', () => {
  it('gridBounds extends bodyGridBounds by the stub sides that have ports', () => {
    const s = shape();
    expect(bodyGridBounds(s)).toMatchObject({
      x: 10,
      y: 20,
      width: 2,
      height: 2
    });
    expect(gridBounds(s)).toMatchObject({ x: 9.5, y: 20, width: 3, height: 2 });
  });

  it('omits the stub extent on a side with no ports', () => {
    const noInputs = shape({ numInputs: 0 });
    expect(gridBounds(noInputs)).toMatchObject({ x: 10, width: 2.5 });
    const noOutputs = shape({ numOutputs: 0 });
    expect(gridBounds(noOutputs)).toMatchObject({ x: 9.5, width: 2.5 });
  });

  it('bounds agree with the rotated port layout in every direction', () => {
    for (const direction of ALL_DIRECTIONS) {
      const s = shape({ direction });
      const bounds = gridBounds(s);
      for (const p of connectionPoints(s)) {
        // Every port sits on the boundary of (or inside) the full AABB.
        expect(p.x).toBeGreaterThanOrEqual(bounds.x);
        expect(p.x).toBeLessThanOrEqual(bounds.right);
        expect(p.y).toBeGreaterThanOrEqual(bounds.y);
        expect(p.y).toBeLessThanOrEqual(bounds.bottom);
      }
      // The body never contains a port (ports sit half a grid off its edge).
      const body = bodyGridBounds(s);
      expect(body.width * body.height).toBe(4);
    }
  });
});

describe('negationBubbleAnchor', () => {
  it('pins input bubbles to the body edge on the port centre-line', () => {
    expect(negationBubbleAnchor(shape(), 'in', 0)).toEqual(new Point(10, 20.5));
    expect(negationBubbleAnchor(shape(), 'in', 1)).toEqual(new Point(10, 21.5));
  });

  it('pins output bubbles to the opposite body edge', () => {
    expect(negationBubbleAnchor(shape(), 'out', 0)).toEqual(
      new Point(12, 20.5)
    );
  });

  it('rotates the anchor exactly with the component', () => {
    expect(
      negationBubbleAnchor(shape({ direction: Direction.S }), 'in', 0)
    ).toEqual(new Point(9.5, 20));
    expect(
      negationBubbleAnchor(shape({ direction: Direction.W }), 'out', 0)
    ).toEqual(new Point(8, 19.5));
    expect(
      negationBubbleAnchor(shape({ direction: Direction.N }), 'out', 0)
    ).toEqual(new Point(10.5, 18));
  });
});
