import { Container, Rectangle } from 'pixi.js';
import { QuadTreeContainer } from './quad-tree-container';
import arrayWithExactContents = jasmine.arrayWithExactContents;

describe('QuadTreeContainer', () => {
	let tree: QuadTreeContainer<Container>;

	beforeEach(() => {
		tree = new QuadTreeContainer<Container>();
	});

	/** Creates a Container whose world bounds (before tree insertion) are (x, y, w, h). */
	function makeItem(x: number, y: number, w: number, h: number): Container {
		return new Container({
			position: { x, y },
			boundsArea: new Rectangle(0, 0, w, h)
		});
	}

	/** Query the full positive coordinate space. */
	function queryAll(): Container[] {
		return Array.from(
			tree.queryRange(
				new Rectangle(0, 0, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
			)
		);
	}

	/** Query the full coordinate plane including negative coordinates. */
	function queryAllFull(): Container[] {
		const half = Number.MAX_SAFE_INTEGER / 2;
		return Array.from(tree.queryRange(new Rectangle(-half, -half, half * 2, half * 2)));
	}

	// ── Sanity check ──────────────────────────────────────────────────────────

	it('standalone Container boundsArea maps to expected world bounds', () => {
		const c = makeItem(10, 20, 30, 40);
		const r = c.getBounds().rectangle;
		expect(r.x).toBe(10);
		expect(r.y).toBe(20);
		expect(r.width).toBe(30);
		expect(r.height).toBe(40);
	});

	// ── insert / queryRange (no split) ────────────────────────────────────────

	describe('insert / queryRange', () => {
		it('empty tree returns no items', () => {
			expect(queryAll()).toEqual([]);
		});

		it('inserted item can be retrieved', () => {
			const c = makeItem(10, 10, 20, 20);
			tree.insert(c);
			expect(queryAll()).toEqual([c]);
		});

		it('item exactly matching the query range boundary is included', () => {
			const c = makeItem(10, 10, 10, 10);
			tree.insert(c);
			expect(
				Array.from(tree.queryRange(new Rectangle(10, 10, 10, 10)))
			).toEqual([c]);
		});

		it('item outside the query range is not returned', () => {
			const inside = makeItem(10, 10, 5, 5);
			const outside = makeItem(100, 100, 5, 5);
			tree.insert(inside);
			tree.insert(outside);

			const result = Array.from(tree.queryRange(new Rectangle(0, 0, 50, 50)));
			expect(result).toContain(inside);
			expect(result).not.toContain(outside);
		});

		it('item partially overlapping the query range is not returned', () => {
			// item right edge at 25, range right edge at 20
			const partial = makeItem(15, 15, 10, 10);
			tree.insert(partial);

			const result = Array.from(tree.queryRange(new Rectangle(0, 0, 20, 20)));
			expect(result).not.toContain(partial);
		});

		it('multiple items in the same leaf are all returned', () => {
			// ≤ MAX_LEAF_ELEMENTS (4) items, no split triggered
			const items = [
				makeItem(10, 10, 5, 5),
				makeItem(30, 30, 5, 5),
				makeItem(50, 50, 5, 5)
			];
			for (const c of items) tree.insert(c);

			expect(queryAll()).toEqual(arrayWithExactContents(items));
		});

		it('items placed in different quadrants are all returned (pre-split)', () => {
			// Only 4 items: they all stay in the root leaf, no split
			const nw = makeItem(10, 10, 5, 5);
			const ne = makeItem(600, 10, 5, 5);
			const sw = makeItem(10, 600, 5, 5);
			const se = makeItem(600, 600, 5, 5);
			[nw, ne, sw, se].forEach((c) => tree.insert(c));

			expect(queryAll()).toEqual(arrayWithExactContents([nw, ne, sw, se]));
		});

		it('narrow query scoped to one quadrant excludes items in other quadrants', () => {
			const nw = makeItem(10, 10, 5, 5);
			const ne = makeItem(600, 10, 5, 5);
			tree.insert(nw);
			tree.insert(ne);

			// Query only the NW half
			const result = Array.from(tree.queryRange(new Rectangle(0, 0, 512, 512)));
			expect(result).toEqual([nw]);
			expect(result).not.toContain(ne);
		});

		it('item outside the initial tree bounds triggers expansion and stays retrievable', () => {
			const c = makeItem(5000, 5000, 10, 10);
			tree.insert(c);
			expect(queryAll()).toContain(c);
		});

		it('two items — one near, one far — are both retrievable after expansion', () => {
			const near = makeItem(10, 10, 5, 5);
			const far = makeItem(40000, 40000, 100, 100);
			tree.insert(near);
			tree.insert(far);

			expect(queryAll()).toEqual(arrayWithExactContents([near, far]));
		});

		it('inserting 1000 items retrieves them all', () => {
			const items: Container[] = [];
			for (let i = 0; i < 1000; i++) {
				const x = (i % 50) * 18;
				const y = Math.floor(i / 50) * 18;
				const c = makeItem(x, y, 5, 5);
				items.push(c);
				tree.insert(c);
			}
			const result = queryAll();
			const resultSet = new Set(result);
			expect(result.length).toBe(items.length);
			for (const item of items) {
				expect(resultSet.has(item)).toBeTrue();
			}
		});

		it('queryRange with a zero-size rectangle returns nothing', () => {
			tree.insert(makeItem(10, 10, 5, 5));
			expect(
				Array.from(tree.queryRange(new Rectangle(100, 100, 0, 0)))
			).toEqual([]);
		});

		it('after expansion, a narrow query excludes the far item', () => {
			const near = makeItem(10, 10, 5, 5);
			const far = makeItem(5000, 5000, 10, 10);
			tree.insert(near);
			tree.insert(far);

			const result = Array.from(tree.queryRange(new Rectangle(0, 0, 100, 100)));
			expect(result).toContain(near);
			expect(result).not.toContain(far);
		});

		it('leaf splits when more than 4 items accumulate in the same area and all are still returned', () => {
			// 5 items in the same region exceeds MAX_LEAF_ELEMENTS and forces a split
			const items = Array.from({ length: 5 }, (_, i) =>
				makeItem(i * 5, i * 5, 2, 2)
			);
			for (const c of items) tree.insert(c);

			expect(queryAll()).toEqual(arrayWithExactContents(items));
		});
	});

	// ── cross-quadrant items (branchItems) ───────────────────────────────────

	describe('cross-quadrant items (branchItems)', () => {
		// The initial tree spans (0, 0, 1024, 1024); its midlines are x=512 and y=512.
		// An item whose bounds straddle a midline cannot fit in any child quadrant and is
		// placed in the containing entry's branchItems instead of leafItems.

		it('item straddling the vertical midline is inserted and retrieved', () => {
			const cross = makeItem(509, 10, 20, 5); // right edge at 529, spans x=512
			tree.insert(cross);
			expect(queryAll()).toContain(cross);
		});

		it('cross-boundary item is returned by a query range that fully contains it', () => {
			const cross = makeItem(509, 10, 20, 5);
			tree.insert(cross);
			expect(
				Array.from(tree.queryRange(new Rectangle(0, 0, 600, 100)))
			).toContain(cross);
		});

		it('cross-boundary item is not returned by a query range that only partially overlaps it', () => {
			const cross = makeItem(509, 10, 20, 5);
			tree.insert(cross);
			// range ends at x=512 but item extends to x=529
			expect(
				Array.from(tree.queryRange(new Rectangle(0, 0, 512, 100)))
			).not.toContain(cross);
		});

		it('cross-boundary item can be removed', () => {
			const cross = makeItem(509, 10, 20, 5);
			tree.insert(cross);
			expect(tree.remove(cross)).toBeTrue();
			expect(queryAll()).not.toContain(cross);
		});

		it('removing a cross-boundary item leaves other items intact', () => {
			const cross = makeItem(509, 10, 20, 5);
			const normal = makeItem(10, 10, 5, 5);
			tree.insert(cross);
			tree.insert(normal);
			tree.remove(cross);
			expect(queryAll()).toEqual([normal]);
		});
	});

	// ── remove ────────────────────────────────────────────────────────────────

	describe('remove', () => {
		it('returns false for an element not in the tree', () => {
			expect(tree.remove(makeItem(0, 0, 10, 10))).toBe(false);
		});

		it('returns true when the element was present', () => {
			const c = makeItem(10, 10, 5, 5);
			tree.insert(c);
			expect(tree.remove(c)).toBe(true);
		});

		it('removed item is no longer returned by queryRange', () => {
			const c = makeItem(10, 10, 5, 5);
			tree.insert(c);
			tree.remove(c);
			expect(queryAll()).toEqual([]);
		});

		it('removing one item leaves remaining items intact', () => {
			const keep = makeItem(10, 10, 5, 5);
			const discard = makeItem(100, 100, 5, 5);
			tree.insert(keep);
			tree.insert(discard);
			tree.remove(discard);

			expect(queryAll()).toEqual([keep]);
		});

		it('removing multiple items leaves unremoved items intact', () => {
			const items = Array.from({ length: 10 }, (_, i) =>
				makeItem(i * 20, i * 20, 5, 5)
			);
			for (const c of items) tree.insert(c);

			for (const i of [1, 3, 5, 7, 9]) tree.remove(items[i]);

			const expected = items.filter((_, i) => ![1, 3, 5, 7, 9].includes(i));
			expect(queryAll()).toEqual(arrayWithExactContents(expected));
		});

		it('tree compacts after enough elements are removed', () => {
			// Insert 5 items to force a split, then remove 4 to trigger minification
			const items = Array.from({ length: 5 }, (_, i) =>
				makeItem(i * 5, i * 5, 2, 2)
			);
			for (const c of items) tree.insert(c);

			for (const c of items.slice(1)) tree.remove(c);

			expect(queryAll()).toEqual([items[0]]);
		});

		it('multi-level compaction: remaining item is still retrievable after a two-level split collapses', () => {
			// 1 NE item + 5 NW items forces: root to split, then NW to split.
			// The NW items are spread across all four NW sub-quadrants so NW.nw
			// never overflows a third time — the tree is exactly two levels deep.
			// Removing NE and four of the NW items brings total to 1, which
			// triggers recursive minifyBranch through both NW and root.
			const ne = makeItem(600, 10, 5, 5);
			const nw = [
				makeItem(10, 10, 5, 5), // → NW.nw after NW splits
				makeItem(280, 10, 5, 5), // → NW.ne after NW splits
				makeItem(10, 280, 5, 5), // → NW.sw after NW splits
				makeItem(280, 280, 5, 5), // → NW.se after NW splits
				makeItem(100, 100, 5, 5) // survivor, also in NW.nw
			];

			tree.insert(ne);
			for (const c of nw) tree.insert(c);

			tree.remove(ne);
			for (const c of nw.slice(0, 4)) tree.remove(c);

			expect(queryAll()).toEqual([nw[4]]);
		});
	});

	// ── negative coordinates ─────────────────────────────────────────────────

	describe('negative coordinates', () => {
		it('item with negative x is retrievable', () => {
			const c = makeItem(-500, 10, 5, 5);
			tree.insert(c);
			expect(queryAllFull()).toContain(c);
		});

		it('item with negative y is retrievable', () => {
			const c = makeItem(10, -500, 5, 5);
			tree.insert(c);
			expect(queryAllFull()).toContain(c);
		});

		it('item with negative x and y is retrievable', () => {
			const c = makeItem(-500, -500, 5, 5);
			tree.insert(c);
			expect(queryAllFull()).toContain(c);
		});

		it('positive and negative items coexist and are both retrievable', () => {
			const pos = makeItem(100, 100, 5, 5);
			const neg = makeItem(-100, -100, 5, 5);
			tree.insert(pos);
			tree.insert(neg);
			expect(queryAllFull()).toEqual(arrayWithExactContents([pos, neg]));
		});

		it('queryRange scoped to negative space excludes positive items', () => {
			const pos = makeItem(100, 100, 5, 5);
			const neg = makeItem(-200, -200, 5, 5);
			tree.insert(pos);
			tree.insert(neg);

			const result = Array.from(tree.queryRange(new Rectangle(-300, -300, 200, 200)));
			expect(result).toContain(neg);
			expect(result).not.toContain(pos);
		});

		it('negative-coordinate item can be removed', () => {
			const c = makeItem(-100, -100, 5, 5);
			tree.insert(c);
			expect(tree.remove(c)).toBeTrue();
			expect(queryAllFull()).not.toContain(c);
		});

		it('removing a negative-coordinate item leaves positive items intact', () => {
			const pos = makeItem(100, 100, 5, 5);
			const neg = makeItem(-100, -100, 5, 5);
			tree.insert(pos);
			tree.insert(neg);
			tree.remove(neg);
			expect(queryAllFull()).toEqual([pos]);
		});

		it('many items spread across all four sign quadrants are all retrievable', () => {
			const items = [
				makeItem(100, 100, 5, 5),
				makeItem(-100, 100, 5, 5),
				makeItem(100, -100, 5, 5),
				makeItem(-100, -100, 5, 5)
			];
			for (const c of items) tree.insert(c);
			expect(queryAllFull()).toEqual(arrayWithExactContents(items));
		});
	});

	// ── panned parent ────────────────────────────────────────────────────────
	//
	// All queryRange calls use grid-space (local) coordinates.
	// Panning the parent shifts screen-space positions but must not affect
	// where items appear in grid space.

	describe('with a panned parent', () => {
		let parent: Container;

		beforeEach(() => {
			parent = new Container();
			parent.addChild(tree);
		});

		it('item inserted before pan is found at its original grid coordinates after pan', () => {
			const c = makeItem(10, 10, 5, 5);
			tree.insert(c);
			parent.x = 500;
			parent.y = 300;
			expect(
				Array.from(tree.queryRange(new Rectangle(10, 10, 5, 5)))
			).toContain(c);
		});

		it('pan does not shift an item into a different grid position', () => {
			const c = makeItem(10, 10, 5, 5);
			tree.insert(c);
			parent.x = 500;
			parent.y = 300;
			// if pan leaked into grid coords, the item would appear at (510, 310)
			expect(
				Array.from(tree.queryRange(new Rectangle(510, 310, 5, 5)))
			).not.toContain(c);
		});

		it('item inserted after pan lands at grid coordinates, not screen coordinates', () => {
			parent.x = 500;
			parent.y = 300;
			const c = makeItem(10, 10, 5, 5);
			tree.insert(c);
			expect(
				Array.from(tree.queryRange(new Rectangle(10, 10, 5, 5)))
			).toContain(c);
			expect(
				Array.from(tree.queryRange(new Rectangle(510, 310, 5, 5)))
			).not.toContain(c);
		});

		it('query correctly scopes to a grid subregion while panned', () => {
			parent.x = 1000;
			parent.y = 1000;
			const near = makeItem(10, 10, 5, 5);
			const far = makeItem(600, 600, 5, 5);
			tree.insert(near);
			tree.insert(far);
			const result = Array.from(tree.queryRange(new Rectangle(0, 0, 100, 100)));
			expect(result).toContain(near);
			expect(result).not.toContain(far);
		});

		it('items inserted before and after a pan are both retrievable', () => {
			const before = makeItem(10, 10, 5, 5);
			tree.insert(before);
			parent.x = 500;
			parent.y = 300;
			const after = makeItem(100, 100, 5, 5);
			tree.insert(after);
			expect(queryAll()).toEqual(arrayWithExactContents([before, after]));
		});

		it('leaf split triggered while panned preserves all items', () => {
			parent.x = 500;
			parent.y = 300;
			// 5 items exceed MAX_LEAF_ELEMENTS and force a split
			const items = Array.from({ length: 5 }, (_, i) =>
				makeItem(i * 5, i * 5, 2, 2)
			);
			for (const c of items) tree.insert(c);
			expect(queryAll()).toEqual(arrayWithExactContents(items));
		});

		it('tree expansion triggered while panned preserves item locations', () => {
			parent.x = 500;
			parent.y = 300;
			const near = makeItem(10, 10, 5, 5);
			const far = makeItem(5000, 5000, 10, 10);
			tree.insert(near);
			tree.insert(far);
			expect(
				Array.from(tree.queryRange(new Rectangle(0, 0, 100, 100)))
			).toContain(near);
			expect(
				Array.from(tree.queryRange(new Rectangle(4990, 4990, 30, 30)))
			).toContain(far);
			expect(
				Array.from(tree.queryRange(new Rectangle(0, 0, 100, 100)))
			).not.toContain(far);
		});

		it('re-inserting an item with a new position after pan relocates it in grid space', () => {
			const c = makeItem(10, 10, 5, 5);
			tree.insert(c);
			parent.x = 500;
			parent.y = 300;
			c.position.set(500, 500);
			tree.insert(c);
			expect(
				Array.from(tree.queryRange(new Rectangle(0, 0, 100, 100)))
			).not.toContain(c);
			expect(
				Array.from(tree.queryRange(new Rectangle(500, 500, 50, 50)))
			).toContain(c);
		});

		it('remove after pan correctly removes the item', () => {
			const c = makeItem(10, 10, 5, 5);
			tree.insert(c);
			parent.x = 500;
			parent.y = 300;
			expect(tree.remove(c)).toBeTrue();
			expect(queryAll()).not.toContain(c);
		});

		it('items survive multiple sequential pan changes', () => {
			const c = makeItem(10, 10, 5, 5);
			tree.insert(c);
			parent.x = 100;
			parent.y = 100;
			parent.x = -200;
			parent.y = 50;
			parent.x = 999;
			parent.y = -999;
			expect(
				Array.from(tree.queryRange(new Rectangle(10, 10, 5, 5)))
			).toContain(c);
		});

		it('100 items inserted while panned are all retrievable', () => {
			parent.x = 12345;
			parent.y = -6789;
			const items: Container[] = [];
			for (let i = 0; i < 100; i++) {
				const x = (i % 10) * 20;
				const y = Math.floor(i / 10) * 20;
				const c = makeItem(x, y, 5, 5);
				items.push(c);
				tree.insert(c);
			}
			const result = queryAll();
			const resultSet = new Set(result);
			expect(result.length).toBe(items.length);
			for (const item of items) {
				expect(resultSet.has(item)).toBeTrue();
			}
		});

		it('zoom (parent scale) does not corrupt grid-space lookups', () => {
			parent.scale.set(2);
			parent.x = 300;
			parent.y = 200;
			const c = makeItem(10, 10, 5, 5);
			tree.insert(c);
			expect(
				Array.from(tree.queryRange(new Rectangle(10, 10, 5, 5)))
			).toContain(c);
		});
	});

	// ── re-insertion ──────────────────────────────────────────────────────────

	describe('re-insertion', () => {
		it('re-inserting an item with a new position relocates it', () => {
			const c = makeItem(10, 10, 5, 5);
			tree.insert(c);

			c.position.set(500, 500);
			tree.insert(c);

			expect(
				Array.from(tree.queryRange(new Rectangle(0, 0, 100, 100)))
			).not.toContain(c);
			expect(
				Array.from(tree.queryRange(new Rectangle(500, 500, 50, 50)))
			).toContain(c);
		});

		it('re-inserted item appears exactly once in query results', () => {
			const c = makeItem(10, 10, 5, 5);
			tree.insert(c);
			tree.insert(c); // re-insert without moving

			expect(queryAll().filter((x) => x === c).length).toBe(1);
		});
	});
});
