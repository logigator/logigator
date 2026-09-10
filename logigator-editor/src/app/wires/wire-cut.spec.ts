import { describe, expect, it } from 'vitest';
import { Point, Rectangle } from 'pixi.js';
import { cutWire } from './wire-cut';
import { Wire } from './wire';
import { WireDirection } from '@logigator/core';

// Mirrors Wire.gridBounds: floor the position, extend the span by 1.
function fakeWire(
  direction: WireDirection,
  x: number,
  y: number,
  length: number
): Wire {
  const gridX = Math.floor(x);
  const gridY = Math.floor(y);
  const gridBounds =
    direction === WireDirection.HORIZONTAL
      ? new Rectangle(gridX, gridY, length + 1, 1)
      : new Rectangle(gridX, gridY, 1, length + 1);

  return {
    direction,
    position: new Point(x, y),
    length,
    gridBounds
  } as unknown as Wire;
}

describe('cutWire', () => {
  describe('horizontal wire', () => {
    it("returns kind=keep when the wire's gridBounds is fully contained in the rect", () => {
      // gridBounds (3, 4, 6, 1), properly contained under the strict-< rule.
      const wire = fakeWire(WireDirection.HORIZONTAL, 3.5, 4.5, 5);
      const result = cutWire(wire, new Rectangle(2, 4, 8, 1));

      expect(result.kind).toBe('keep');
    });

    it("returns kind=keep when the rect's edges align with the wire's half-grid endpoints", () => {
      // containsRect fails (3 < 3.5), but the cut clamps to the whole wire.
      const wire = fakeWire(WireDirection.HORIZONTAL, 3.5, 4.5, 5);
      const result = cutWire(wire, new Rectangle(3.5, 4, 5, 1));

      expect(result.kind).toBe('keep');
    });

    it('returns kind=skip when the centerline is outside the rect Y range', () => {
      // The rect reaches y=4.1, catching gridBounds' half-cell padding but not
      // the centerline at y=4.5.
      const wire = fakeWire(WireDirection.HORIZONTAL, 0.5, 4.5, 10);
      const result = cutWire(wire, new Rectangle(0, 3.7, 12, 0.4));

      expect(result.kind).toBe('skip');
    });

    it('returns kind=skip when the centerline is outside the rect X range', () => {
      const wire = fakeWire(WireDirection.HORIZONTAL, 0.5, 4.5, 2);
      const result = cutWire(wire, new Rectangle(5, 4, 3, 1));

      expect(result.kind).toBe('skip');
    });

    it('cuts a wire crossing only the left edge into 2 pieces, insideIndex=1', () => {
      // Endpoints 3.5 → 8.5; leftCut 4.5, rightCut clamped to wEnd 8.5.
      const wire = fakeWire(WireDirection.HORIZONTAL, 3.5, 4.5, 5);
      const result = cutWire(wire, new Rectangle(5, 4, 5, 1));

      expect(result.kind).toBe('cut');
      if (result.kind !== 'cut') return;

      expect(result.pieces.length).toBe(2);
      expect(result.insideIndex).toBe(1);

      expect(result.pieces[0].position.x).toBe(3.5);
      expect(result.pieces[0].length).toBe(1);
      expect(result.pieces[1].position.x).toBe(4.5);
      expect(result.pieces[1].length).toBe(4);
    });

    it('cuts a wire crossing only the right edge into 2 pieces, insideIndex=0', () => {
      // leftCut clamped to wStart 3.5; rightCut 7.5, the first past rect.right.
      const wire = fakeWire(WireDirection.HORIZONTAL, 3.5, 4.5, 5);
      const result = cutWire(wire, new Rectangle(0, 4, 7, 1));

      expect(result.kind).toBe('cut');
      if (result.kind !== 'cut') return;

      expect(result.pieces.length).toBe(2);
      expect(result.insideIndex).toBe(0);

      expect(result.pieces[0].position.x).toBe(3.5);
      expect(result.pieces[0].length).toBe(4);
      expect(result.pieces[1].position.x).toBe(7.5);
      expect(result.pieces[1].length).toBe(1);
    });

    it('cuts a wire crossing both edges into 3 pieces, insideIndex=1', () => {
      // leftCut 4.5, rightCut 7.5, both outside the rect's 5 … 7.
      const wire = fakeWire(WireDirection.HORIZONTAL, 3.5, 4.5, 5);
      const result = cutWire(wire, new Rectangle(5, 4, 2, 1));

      expect(result.kind).toBe('cut');
      if (result.kind !== 'cut') return;

      expect(result.pieces.length).toBe(3);
      expect(result.insideIndex).toBe(1);

      expect(result.pieces[0].position.x).toBe(3.5);
      expect(result.pieces[0].length).toBe(1);
      expect(result.pieces[1].position.x).toBe(4.5);
      expect(result.pieces[1].length).toBe(3);
      expect(result.pieces[2].position.x).toBe(7.5);
      expect(result.pieces[2].length).toBe(1);
    });

    it('snaps non-integer rect bounds out to the enclosing half-grid positions', () => {
      // The rect spans 4.7 … 7.3, so the cuts snap out to 4.5 and 7.5.
      const wire = fakeWire(WireDirection.HORIZONTAL, 0.5, 4.5, 10);
      const result = cutWire(wire, new Rectangle(4.7, 4, 2.6, 1));

      expect(result.kind).toBe('cut');
      if (result.kind !== 'cut') return;

      expect(result.pieces.length).toBe(3);
      expect(result.pieces[0].length).toBe(4); // 0.5 → 4.5
      expect(result.pieces[1].position.x).toBe(4.5);
      expect(result.pieces[1].length).toBe(3); // 4.5 → 7.5
      expect(result.pieces[2].position.x).toBe(7.5);
      expect(result.pieces[2].length).toBe(3); // 7.5 → 10.5
    });

    it('cuts a half-grid-aligned rect exactly on its own edges', () => {
      // The rect is already on the lattice, so the inside piece matches it.
      const wire = fakeWire(WireDirection.HORIZONTAL, 0.5, 4.5, 10);
      const result = cutWire(wire, new Rectangle(4.5, 4, 3, 1));

      expect(result.kind).toBe('cut');
      if (result.kind !== 'cut') return;

      expect(result.pieces.length).toBe(3);
      expect(result.pieces[1].position.x).toBe(4.5);
      expect(result.pieces[1].length).toBe(3);
    });

    // Boxing a single grid unit means drawing strictly inside the segment
    // aimed at, so the snapping must widen to that one unit and no further.
    it('cuts exactly one unit for a rect drawn inside a single grid unit', () => {
      // The rect spans 4.7 … 5.3, strictly between the lattice at 4.5 and 5.5.
      const wire = fakeWire(WireDirection.HORIZONTAL, 0.5, 4.5, 10);
      const result = cutWire(wire, new Rectangle(4.7, 4, 0.6, 1));

      expect(result.kind).toBe('cut');
      if (result.kind !== 'cut') return;

      expect(result.pieces.length).toBe(3);
      expect(result.insideIndex).toBe(1);
      expect(result.pieces[1].position.x).toBe(4.5);
      expect(result.pieces[1].length).toBe(1);
      expect(result.pieces[2].position.x).toBe(5.5);
    });

    it('returns kind=keep when the wire endpoint aligns exactly with the rect edge', () => {
      // Both cuts clamp to the wire's own endpoints, so the inside piece would
      // equal the original.
      const wire = fakeWire(WireDirection.HORIZONTAL, 4.5, 4.5, 4);
      const result = cutWire(wire, new Rectangle(5, 4, 4, 1));

      expect(result.kind).toBe('keep');
    });

    it('returns kind=keep for a length-1 wire whose centerline is fully inside the rect', () => {
      const wire = fakeWire(WireDirection.HORIZONTAL, 4.5, 4.5, 1);
      const result = cutWire(wire, new Rectangle(5, 4, 5, 1));

      expect(result.kind).toBe('keep');
    });
  });

  describe('vertical wire', () => {
    it('cuts a vertical wire crossing the top edge into 2 pieces', () => {
      // topCut 4.5, bottomCut clamped to wEnd 8.5.
      const wire = fakeWire(WireDirection.VERTICAL, 4.5, 3.5, 5);
      const result = cutWire(wire, new Rectangle(4, 5, 1, 5));

      expect(result.kind).toBe('cut');
      if (result.kind !== 'cut') return;

      expect(result.pieces.length).toBe(2);
      expect(result.insideIndex).toBe(1);

      expect(result.pieces[0].position.y).toBe(3.5);
      expect(result.pieces[0].length).toBe(1);
      expect(result.pieces[0].direction).toBe(WireDirection.VERTICAL);
      expect(result.pieces[1].position.y).toBe(4.5);
      expect(result.pieces[1].length).toBe(4);
    });

    it('cuts a vertical wire crossing the bottom edge into 2 pieces', () => {
      const wire = fakeWire(WireDirection.VERTICAL, 4.5, 3.5, 5);
      const result = cutWire(wire, new Rectangle(4, 0, 1, 7));

      expect(result.kind).toBe('cut');
      if (result.kind !== 'cut') return;

      expect(result.pieces.length).toBe(2);
      expect(result.insideIndex).toBe(0);
      expect(result.pieces[0].position.y).toBe(3.5);
      expect(result.pieces[0].length).toBe(4);
      expect(result.pieces[1].position.y).toBe(7.5);
      expect(result.pieces[1].length).toBe(1);
    });

    it('cuts a vertical wire crossing both edges into 3 pieces', () => {
      const wire = fakeWire(WireDirection.VERTICAL, 4.5, 3.5, 5);
      const result = cutWire(wire, new Rectangle(4, 5, 1, 2));

      expect(result.kind).toBe('cut');
      if (result.kind !== 'cut') return;

      expect(result.pieces.length).toBe(3);
      expect(result.insideIndex).toBe(1);
    });

    it('returns kind=skip when a vertical wire centerline is outside the rect X range', () => {
      const wire = fakeWire(WireDirection.VERTICAL, 4.5, 0.5, 10);
      const result = cutWire(wire, new Rectangle(3.7, 0, 0.4, 12));

      expect(result.kind).toBe('skip');
    });
  });
});
