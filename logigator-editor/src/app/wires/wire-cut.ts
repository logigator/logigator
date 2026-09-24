import { Point, Rectangle } from 'pixi.js';
import { Wire } from './wire';
import { WireDirection } from '@logigator/core';

export interface WireCutPiece {
  position: Point;
  direction: WireDirection;
  length: number;
}

export type WireCutResult =
  | { kind: 'skip' }
  | { kind: 'keep' }
  | { kind: 'cut'; pieces: WireCutPiece[]; insideIndex: number };

// How a wire interacts with `rect`:
//   - skip: the centerline is outside the rect; do not select.
//   - keep: the wire stays whole and is selected.
//   - cut: 2–3 pieces, `pieces[insideIndex]` being the one to select.
//
// The marquee is free-form, but wire endpoints live on the half-grid lattice
// (k + 0.5), so cuts snap to the first lattice position at or outside the rect
// on each side.
export function cutWire(wire: Wire, rect: Rectangle): WireCutResult {
  if (rect.containsRect(wire.gridBounds)) return { kind: 'keep' };

  const direction = wire.direction;
  const horizontal = direction === WireDirection.HORIZONTAL;

  const wStart = horizontal ? wire.position.x : wire.position.y;
  const wEnd = wStart + wire.length;
  const wPerp = horizontal ? wire.position.y : wire.position.x;

  const rStart = horizontal ? rect.x : rect.y;
  const rEnd = horizontal ? rect.right : rect.bottom;
  const rPerpStart = horizontal ? rect.y : rect.x;
  const rPerpEnd = horizontal ? rect.bottom : rect.right;

  // The centerline is outside the rect: only gridBounds' half-cell padding
  // produced the intersect.
  if (wPerp < rPerpStart || wPerp > rPerpEnd) return { kind: 'skip' };

  // The last lattice position at or before the near edge, the first at or
  // after the far edge.
  const leftCut = Math.max(wStart, Math.floor(rStart - 0.5) + 0.5);
  const rightCut = Math.min(wEnd, Math.ceil(rEnd - 0.5) + 0.5);

  // The centerline does not overlap the rect's range along the wire's axis.
  if (rightCut <= leftCut) return { kind: 'skip' };

  const pieces: WireCutPiece[] = [];
  const makePos = (s: number): Point =>
    horizontal ? new Point(s, wPerp) : new Point(wPerp, s);

  let insideIndex = 0;
  if (wStart < leftCut) {
    pieces.push({
      position: makePos(wStart),
      direction,
      length: leftCut - wStart
    });
    insideIndex = 1;
  }
  pieces.push({
    position: makePos(leftCut),
    direction,
    length: rightCut - leftCut
  });
  if (wEnd > rightCut) {
    pieces.push({
      position: makePos(rightCut),
      direction,
      length: wEnd - rightCut
    });
  }

  // The clamping collapsed back to the original wire: the centerline was
  // inside all along, with the rect aligned to its half-grid endpoints.
  if (pieces.length === 1 && pieces[0].length === wire.length) {
    return { kind: 'keep' };
  }

  return { kind: 'cut', pieces, insideIndex };
}
