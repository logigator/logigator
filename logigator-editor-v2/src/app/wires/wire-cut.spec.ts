import { Point, Rectangle } from 'pixi.js';
import { cutWire } from './wire-cut';
import { Wire } from './wire';
import { WireDirection } from './wire-direction.enum';

// Fake wire matching cutWire's read-only access pattern. Mirrors
// Wire.gridBounds: floor the position and extend the spanning side by 1.
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
			// Wire (3.5, 4.5) length 5 → gridBounds (3, 4, 6, 1).
			// Rect (2, 4, 8, 1) properly contains it (strict-< on the right edge).
			const wire = fakeWire(WireDirection.HORIZONTAL, 3.5, 4.5, 5);
			const result = cutWire(wire, new Rectangle(2, 4, 8, 1));

			expect(result.kind).toBe('keep');
		});

		it("returns kind=keep when the rect's edges align with the wire's half-grid endpoints", () => {
			// Wire (3.5, 4.5) length 5 → endpoints 3.5 → 8.5. Rect (3.5, 4, 5, 1).
			// containsRect fails (3 < 3.5) but the cut clamps to the original wire.
			const wire = fakeWire(WireDirection.HORIZONTAL, 3.5, 4.5, 5);
			const result = cutWire(wire, new Rectangle(3.5, 4, 5, 1));

			expect(result.kind).toBe('keep');
		});

		it('returns kind=skip when the centerline is outside the rect Y range', () => {
			// Wire at y=4.5 → gridBounds.y range [4, 5). Rect.y=3.7 height=0.4 → rect.bottom=4.1.
			// gridBounds intersects rect via 0.1 of half-cell padding, but centerline y=4.5 is outside.
			const wire = fakeWire(WireDirection.HORIZONTAL, 0.5, 4.5, 10);
			const result = cutWire(wire, new Rectangle(0, 3.7, 12, 0.4));

			expect(result.kind).toBe('skip');
		});

		it('returns kind=skip when the centerline is outside the rect X range', () => {
			// Wire (0.5, 4.5) length 2 → endpoints 0.5 → 2.5. Rect (5, 4, 3, 1).
			const wire = fakeWire(WireDirection.HORIZONTAL, 0.5, 4.5, 2);
			const result = cutWire(wire, new Rectangle(5, 4, 3, 1));

			expect(result.kind).toBe('skip');
		});

		it('cuts a wire crossing only the left edge into 2 pieces, insideIndex=1', () => {
			// Wire (3.5, 4.5) length 5 → endpoints 3.5 → 8.5. Rect (5, 4, 5, 1) → rect.right=10.
			// leftCut = floor(5) - 0.5 = 4.5; rightCut clamped to wEnd=8.5.
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
			// Wire (3.5, 4.5) length 5. Rect (0, 4, 7, 1) → rect.right=7.
			// leftCut clamped to wStart=3.5. rightCut = ceil(7) + 0.5 = 7.5.
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
			// Wire (3.5, 4.5) length 5. Rect (5, 4, 2, 1) → rect.x=5, rect.right=7.
			// leftCut = 4.5; rightCut = 7.5.
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

		it('snaps non-integer rect bounds so outside pieces sit strictly outside the rect', () => {
			// Wire (0.5, 4.5) length 10. Rect (4.7, 4, 2.6, 1) → rect.x=4.7, rect.right=7.3.
			// leftCut = floor(4.7) - 0.5 = 3.5; rightCut = ceil(7.3) + 0.5 = 8.5.
			// Outside pieces have gridBounds ending exactly at integer 4 and starting at 8 —
			// strictly outside the rect [4.7, 7.3] (so the SelectionManager's id-based
			// inside lookup gives the right answer regardless of the leak risk for
			// non-integer bounds).
			const wire = fakeWire(WireDirection.HORIZONTAL, 0.5, 4.5, 10);
			const result = cutWire(wire, new Rectangle(4.7, 4, 2.6, 1));

			expect(result.kind).toBe('cut');
			if (result.kind !== 'cut') return;

			expect(result.pieces.length).toBe(3);
			expect(result.pieces[0].length).toBe(3); // 0.5 → 3.5
			expect(result.pieces[1].position.x).toBe(3.5);
			expect(result.pieces[1].length).toBe(5); // 3.5 → 8.5
			expect(result.pieces[2].position.x).toBe(8.5);
			expect(result.pieces[2].length).toBe(2); // 8.5 → 10.5
		});

		it('handles a half-grid-aligned rect by snapping cuts further out', () => {
			// Rect.x=4.5, rect.right=7.5 (both at half-grid).
			// leftCut = floor(4.5) - 0.5 = 3.5; rightCut = ceil(7.5) + 0.5 = 8.5.
			const wire = fakeWire(WireDirection.HORIZONTAL, 0.5, 4.5, 10);
			const result = cutWire(wire, new Rectangle(4.5, 4, 3, 1));

			expect(result.kind).toBe('cut');
			if (result.kind !== 'cut') return;

			expect(result.pieces.length).toBe(3);
			expect(result.pieces[1].position.x).toBe(3.5);
			expect(result.pieces[1].length).toBe(5);
		});

		it('returns kind=keep when the wire endpoint aligns exactly with the rect edge', () => {
			// Wire (4.5, 4.5) length 4 → endpoints 4.5 → 8.5. Rect (5, 4, 4, 1) → rect.x=5, rect.right=9.
			// leftCut = 4.5 = wStart → no outside-left.
			// rightCut = ceil(9) + 0.5 = 9.5; clamped to wEnd=8.5 → no outside-right.
			// Inside piece would equal the original wire → keep.
			const wire = fakeWire(WireDirection.HORIZONTAL, 4.5, 4.5, 4);
			const result = cutWire(wire, new Rectangle(5, 4, 4, 1));

			expect(result.kind).toBe('keep');
		});

		it('returns kind=keep for a length-1 wire whose centerline is fully inside the rect', () => {
			// Wire (4.5, 4.5) length 1 → endpoints 4.5 → 5.5. Rect (5, 4, 5, 1).
			const wire = fakeWire(WireDirection.HORIZONTAL, 4.5, 4.5, 1);
			const result = cutWire(wire, new Rectangle(5, 4, 5, 1));

			expect(result.kind).toBe('keep');
		});
	});

	describe('vertical wire', () => {
		it('cuts a vertical wire crossing the top edge into 2 pieces', () => {
			// Wire (4.5, 3.5) length 5. Rect (4, 5, 1, 5) → rect.y=5, rect.bottom=10.
			// topCut = floor(5) - 0.5 = 4.5. bottomCut clamped to wEnd=8.5.
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
