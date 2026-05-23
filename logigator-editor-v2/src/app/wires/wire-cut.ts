import { Point, Rectangle } from 'pixi.js';
import { Wire } from './wire';
import { WireDirection } from './wire-direction.enum';

export interface WireCutPiece {
	position: Point;
	direction: WireDirection;
	length: number;
}

export type WireCutResult =
	| { kind: 'skip' }
	| { kind: 'keep' }
	| { kind: 'cut'; pieces: WireCutPiece[]; insideIndex: number };

// Decides how a wire interacts with `rect`:
//   - skip: wire's centerline is outside the rect; do not select.
//   - keep: wire stays whole and should be selected (fully inside the rect, or
//     centerline inside with endpoints aligned to the rect edges).
//   - cut: wire is split into 2–3 axis-aligned pieces; `pieces[insideIndex]`
//     is the piece overlapping the rect (to be selected), the others are the
//     outside remnants.
//
// Cuts land on the first half-grid position OUTSIDE the rect on each side so
// the resulting outside pieces never share a half-cell with the rect's
// interior. This is required because the SelectionManager uses the piece IDs
// (not gridBounds re-query) to decide which post-cut wires to select.
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

	// Centerline outside the rect's perpendicular range — the half-cell padding
	// of gridBounds is what produced the intersect; do not select.
	if (wPerp < rPerpStart || wPerp > rPerpEnd) return { kind: 'skip' };

	const leftCut = Math.max(wStart, Math.floor(rStart) - 0.5);
	const rightCut = Math.min(wEnd, Math.ceil(rEnd) + 0.5);

	// Centerline X (or Y) doesn't actually overlap the rect range.
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

	// No actual cut happened — the wire's centerline was fully inside the rect
	// (rect aligned to the wire's half-grid endpoints) so containsRect()
	// returned false but the clamping collapsed to the original wire.
	if (pieces.length === 1 && pieces[0].length === wire.length) {
		return { kind: 'keep' };
	}

	return { kind: 'cut', pieces, insideIndex };
}
