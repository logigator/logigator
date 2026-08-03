import { beforeEach, describe, expect, it } from 'vitest';
import { Container, Rectangle } from 'pixi.js';
import { QuadTreeContainer } from './quad-tree-container';
import { GridElement } from './grid-element';
import { arrayWithExactContents } from '../../testing/vitest-helpers';

type TestItem = Container & GridElement;

describe('QuadTreeContainer', () => {
  let tree: QuadTreeContainer<TestItem>;

  beforeEach(() => {
    tree = new QuadTreeContainer<TestItem>();
  });

  /** Creates a Container with a fixed grid-space rectangle (x, y, w, h). */
  function makeItem(x: number, y: number, w: number, h: number): TestItem {
    const c = new Container({ position: { x, y } }) as TestItem;
    const bounds = {
      get(this: TestItem) {
        return new Rectangle(this.position.x, this.position.y, w, h);
      }
    };
    Object.defineProperty(c, 'gridBounds', bounds);
    // Real elements default cullBounds to gridBounds; mirror that here.
    Object.defineProperty(c, 'cullBounds', bounds);
    // Real elements derive this without allocating; here it just has to agree
    // with gridBounds, which is the contract the tree relies on.
    c.intersectsGridBounds = (rect) => rect.intersects(c.gridBounds);
    return c;
  }

  /** Query the full positive coordinate space. */
  function queryAll(): TestItem[] {
    return tree.queryRange(
      new Rectangle(0, 0, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
    );
  }

  /** Query the full coordinate plane including negative coordinates. */
  function queryAllFull(): TestItem[] {
    const half = Number.MAX_SAFE_INTEGER / 2;
    return tree.queryRange(new Rectangle(-half, -half, half * 2, half * 2));
  }

  // ── insert / queryRange (no split) ────────────────────────────────────────

  describe('insert / queryRange', () => {
    it('empty tree returns no items', () => {
      expect(queryAll()).toEqual([]);
    });

    it('inserted item can be retrieved', () => {
      const c = makeItem(10, 10, 5, 5);
      tree.insert(c);
      expect(queryAll()).toEqual([c]);
    });

    it('item exactly matching the query range boundary is included', () => {
      const c = makeItem(10, 10, 5, 5);
      tree.insert(c);
      expect(tree.queryRange(new Rectangle(10, 10, 5, 5))).toEqual([c]);
    });

    it('item outside the query range is not returned', () => {
      const inside = makeItem(10, 10, 5, 5);
      const outside = makeItem(50, 50, 5, 5);
      tree.insert(inside);
      tree.insert(outside);

      const result = tree.queryRange(new Rectangle(0, 0, 25, 25));
      expect(result).toContain(inside);
      expect(result).not.toContain(outside);
    });

    it('item partially overlapping the query range is returned', () => {
      // item x:15-25, y:15-25 overlaps range x:0-20, y:0-20
      const partial = makeItem(15, 15, 10, 10);
      tree.insert(partial);

      const result = tree.queryRange(new Rectangle(0, 0, 20, 20));
      expect(result).toContain(partial);
    });

    it('multiple items in the same leaf are all returned', () => {
      // ≤ MAX_LEAF_ELEMENTS (4) items, no split triggered
      const items = [
        makeItem(2, 2, 3, 3),
        makeItem(20, 20, 3, 3),
        makeItem(40, 40, 3, 3)
      ];
      for (const c of items) tree.insert(c);

      expect(queryAll()).toEqual(arrayWithExactContents(items));
    });

    it('items placed in different quadrants are all returned (pre-split)', () => {
      // Only 4 items: they all stay in the root leaf, no split
      const nw = makeItem(2, 2, 3, 3);
      const ne = makeItem(40, 2, 3, 3);
      const sw = makeItem(2, 40, 3, 3);
      const se = makeItem(40, 40, 3, 3);
      [nw, ne, sw, se].forEach((c) => tree.insert(c));

      expect(queryAll()).toEqual(arrayWithExactContents([nw, ne, sw, se]));
    });

    it('narrow query scoped to one quadrant excludes items in other quadrants', () => {
      const nw = makeItem(2, 2, 3, 3);
      const ne = makeItem(40, 2, 3, 3);
      tree.insert(nw);
      tree.insert(ne);

      // Query only the NW half (initial size = 64, midline 32)
      const result = tree.queryRange(new Rectangle(0, 0, 32, 32));
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
      const items: TestItem[] = [];
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
        expect(resultSet.has(item)).toBe(true);
      }
    });

    it('queryRange with a zero-size rectangle returns nothing', () => {
      tree.insert(makeItem(10, 10, 5, 5));
      expect(tree.queryRange(new Rectangle(100, 100, 0, 0))).toEqual([]);
    });

    it('after expansion, a narrow query excludes the far item', () => {
      const near = makeItem(2, 2, 3, 3);
      const far = makeItem(5000, 5000, 10, 10);
      tree.insert(near);
      tree.insert(far);

      const result = tree.queryRange(new Rectangle(0, 0, 20, 20));
      expect(result).toContain(near);
      expect(result).not.toContain(far);
    });

    it('leaf splits when more than 4 items accumulate in the same area and all are still returned', () => {
      // 5 items in the same region exceeds MAX_LEAF_ELEMENTS and forces a split
      const items = Array.from({ length: 5 }, (_, i) =>
        makeItem(i * 2, i * 2, 1, 1)
      );
      for (const c of items) tree.insert(c);

      expect(queryAll()).toEqual(arrayWithExactContents(items));
    });
  });

  // ── oversize items and loose filing ───────────────────────────────────────

  describe('oversize items and loose filing', () => {
    // The initial tree spans (0, 0, 64, 64). An entry files an element into a
    // child only when the element fits the child's cell (max dimension at most
    // half the entry); larger elements park in the entry's oversizeItems.
    // Position never parks an element high: an entry accepts anything centered
    // in its cell through its loose bounds (the cell doubled, centered), so an
    // item across a cell boundary files as deep as one in the cell's middle.

    it('item wider than half the root is inserted and retrieved', () => {
      const wide = makeItem(2, 30, 40, 1); // maxDim 40 > 32
      tree.insert(wide);
      expect(queryAll()).toContain(wide);
    });

    it('oversize item is returned by a query range that fully contains it', () => {
      const wide = makeItem(2, 30, 40, 1);
      tree.insert(wide);
      expect(tree.queryRange(new Rectangle(0, 0, 60, 40))).toContain(wide);
    });

    it('oversize item is returned by a query range that partially overlaps it', () => {
      const wide = makeItem(2, 30, 40, 1);
      tree.insert(wide);
      // range ends at x=4 but the item extends to x=42; they overlap x:2-4
      expect(tree.queryRange(new Rectangle(0, 0, 4, 40))).toContain(wide);
    });

    it('oversize item can be removed', () => {
      const wide = makeItem(2, 30, 40, 1);
      tree.insert(wide);
      expect(tree.remove(wide)).toBe(true);
      expect(queryAll()).not.toContain(wide);
    });

    it('removing an oversize item leaves other items intact', () => {
      const wide = makeItem(2, 30, 40, 1);
      const normal = makeItem(2, 2, 3, 3);
      tree.insert(wide);
      tree.insert(normal);
      tree.remove(wide);
      expect(queryAll()).toEqual([normal]);
    });

    it('only size parks an item at a branch — midline-crossing items file deep', () => {
      const wide = makeItem(2, 30, 40, 1);
      tree.insert(wide);
      // Five items across the x=32 midline force splits along their column.
      const crossers = Array.from({ length: 5 }, (_, i) =>
        makeItem(31, 2 + i * 2, 2, 1)
      );
      for (const c of crossers) tree.insert(c);

      expect(tree.stats().branchOversize).toBe(1); // the wide item, nothing else
      expect(tree.validate()).toEqual([]);
      expect(queryAll()).toEqual(arrayWithExactContents([wide, ...crossers]));
    });

    it('query pruning honors loose bounds: an item overhanging its cell is found', () => {
      // The cluster's centers all sit east of the x=32 midline, so every item
      // files in cells at x >= 32 — but the first one's extent reaches back to
      // x=31. A query strictly left of every cell must still return it.
      const poker = makeItem(31, 2, 2, 1); // center x=32
      tree.insert(poker);
      const rest = [
        makeItem(33, 2, 1, 1),
        makeItem(33, 4, 1, 1),
        makeItem(35, 2, 1, 1),
        makeItem(35, 4, 1, 1)
      ];
      for (const c of rest) tree.insert(c);

      expect(tree.queryRange(new Rectangle(30, 0, 1.5, 10))).toEqual([poker]);
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
      const discard = makeItem(50, 50, 5, 5);
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
        makeItem(i * 2, i * 2, 1, 1)
      );
      for (const c of items) tree.insert(c);

      for (const c of items.slice(1)) tree.remove(c);

      expect(queryAll()).toEqual([items[0]]);
    });

    it('multi-level compaction: remaining item is still retrievable after a two-level split collapses', () => {
      // With INITIAL_SIZE=64, root NW = (0,0,32,32), NW sub-quadrants are 16x16.
      // 1 NE item + 5 NW items forces: root to split, then NW to split.
      // The NW items are spread across all four NW sub-quadrants so NW.nw
      // never overflows a third time — the tree is exactly two levels deep.
      const ne = makeItem(40, 2, 3, 3);
      const nw = [
        makeItem(2, 2, 3, 3), // → NW.nw after NW splits
        makeItem(18, 2, 3, 3), // → NW.ne after NW splits
        makeItem(2, 18, 3, 3), // → NW.sw after NW splits
        makeItem(18, 18, 3, 3), // → NW.se after NW splits
        makeItem(8, 8, 3, 3) // survivor, also in NW.nw
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

      const result = tree.queryRange(new Rectangle(-300, -300, 200, 200));
      expect(result).toContain(neg);
      expect(result).not.toContain(pos);
    });

    it('negative-coordinate item can be removed', () => {
      const c = makeItem(-100, -100, 5, 5);
      tree.insert(c);
      expect(tree.remove(c)).toBe(true);
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
  // queryRange/insert operate on the items' gridBounds, which are pure data
  // independent of the scene graph. Panning the parent must not affect query
  // results — these tests guard that invariant.

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
      expect(tree.queryRange(new Rectangle(10, 10, 5, 5))).toContain(c);
    });

    it('pan does not shift an item into a different grid position', () => {
      const c = makeItem(10, 10, 5, 5);
      tree.insert(c);
      parent.x = 500;
      parent.y = 300;
      // if pan leaked into grid coords, the item would appear at (510, 310)
      expect(tree.queryRange(new Rectangle(510, 310, 5, 5))).not.toContain(c);
    });

    it('item inserted after pan lands at grid coordinates, not screen coordinates', () => {
      parent.x = 500;
      parent.y = 300;
      const c = makeItem(10, 10, 5, 5);
      tree.insert(c);
      expect(tree.queryRange(new Rectangle(10, 10, 5, 5))).toContain(c);
      expect(tree.queryRange(new Rectangle(510, 310, 5, 5))).not.toContain(c);
    });

    it('query correctly scopes to a grid subregion while panned', () => {
      parent.x = 1000;
      parent.y = 1000;
      const near = makeItem(2, 2, 3, 3);
      const far = makeItem(40, 40, 3, 3);
      tree.insert(near);
      tree.insert(far);
      const result = tree.queryRange(new Rectangle(0, 0, 20, 20));
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
        makeItem(i * 2, i * 2, 1, 1)
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
      expect(tree.queryRange(new Rectangle(0, 0, 20, 20))).toContain(near);
      expect(tree.queryRange(new Rectangle(4990, 4990, 30, 30))).toContain(far);
      expect(tree.queryRange(new Rectangle(0, 0, 20, 20))).not.toContain(far);
    });

    it('re-inserting an item with a new position after pan relocates it in grid space', () => {
      const c = makeItem(10, 10, 5, 5);
      tree.insert(c);
      parent.x = 500;
      parent.y = 300;
      c.position.set(500, 500);
      tree.insert(c);
      expect(tree.queryRange(new Rectangle(0, 0, 20, 20))).not.toContain(c);
      expect(tree.queryRange(new Rectangle(500, 500, 50, 50))).toContain(c);
    });

    it('remove after pan correctly removes the item', () => {
      const c = makeItem(10, 10, 5, 5);
      tree.insert(c);
      parent.x = 500;
      parent.y = 300;
      expect(tree.remove(c)).toBe(true);
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
      expect(tree.queryRange(new Rectangle(10, 10, 5, 5))).toContain(c);
    });

    it('100 items inserted while panned are all retrievable', () => {
      parent.x = 12345;
      parent.y = -6789;
      const items: TestItem[] = [];
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
        expect(resultSet.has(item)).toBe(true);
      }
    });

    it('zoom (parent scale) does not corrupt grid-space lookups', () => {
      parent.scale.set(2);
      parent.x = 300;
      parent.y = 200;
      const c = makeItem(10, 10, 5, 5);
      tree.insert(c);
      expect(tree.queryRange(new Rectangle(10, 10, 5, 5))).toContain(c);
    });
  });

  // ── re-insertion ──────────────────────────────────────────────────────────

  describe('re-insertion', () => {
    it('re-inserting an item with a new position relocates it', () => {
      const c = makeItem(10, 10, 5, 5);
      tree.insert(c);

      c.position.set(500, 500);
      tree.insert(c);

      expect(tree.queryRange(new Rectangle(0, 0, 100, 100))).not.toContain(c);
      expect(tree.queryRange(new Rectangle(500, 500, 50, 50))).toContain(c);
    });

    it('re-inserted item appears exactly once in query results', () => {
      const c = makeItem(10, 10, 5, 5);
      tree.insert(c);
      tree.insert(c); // re-insert without moving

      expect(queryAll().filter((x) => x === c).length).toBe(1);
    });
  });

  // ── debug introspection ───────────────────────────────────────────────────

  describe('validate', () => {
    /** Inserts, moves and removes enough elements to split, expand and minify. */
    function churn(): TestItem[] {
      const items: TestItem[] = [];
      for (let i = 0; i < 200; i++) {
        const c = makeItem((i % 20) * 7, Math.floor(i / 20) * 7, 3, 3);
        items.push(c);
        tree.insert(c);
      }
      // A larger item, an expansion into negative space, and re-insertions.
      items.push(makeItem(30, 30, 6, 6), makeItem(-400, -400, 5, 5));
      for (const c of items.slice(-2)) tree.insert(c);
      for (const c of items.slice(0, 150)) {
        c.position.set(c.position.x + 400, c.position.y + 400);
        tree.insert(c);
      }
      for (const c of items.splice(0, 100)) tree.remove(c);
      return items;
    }

    it('reports no problems for a tree that has split, expanded and minified', () => {
      churn();
      expect(tree.validate()).toEqual([]);
    });

    it('reports an element that moved out of its entry without being re-inserted', () => {
      const items = churn();
      items[0].position.set(9000, 9000);

      expect(tree.validate()).toEqual([
        expect.stringContaining('moved without being re-inserted')
      ]);
    });

    it('accepts oversize items parked at branches under a grown root', () => {
      // Expansion stacks new ancestors above the entries without re-filing
      // anything; an element too large for the old root's children stays
      // parked there — several levels below the new root — and still
      // validates, because its size class matches that entry regardless of
      // what hangs above it.
      tree.insert(makeItem(2, 20, 40, 5)); // maxDim 40 > 32: parks at the root
      for (let i = 0; i < 12; i++) tree.insert(makeItem(i * 2, i, 3, 3));
      tree.insert(makeItem(5000, 5000, 5, 5)); // forces the expansions

      expect(tree.stats().branchOversize).toBeGreaterThan(0);
      expect(tree.validate()).toEqual([]);
    });

    it('reports an element the tree holds but the item map lost', () => {
      const c = makeItem(10, 10, 5, 5);
      tree.insert(c);
      tree.remove(c);
      // Bypasses insert(), exactly as a stray addChild() would.
      tree.children[0].children[1].addChild(c);

      expect(tree.validate().length).toBeGreaterThan(0);
    });
  });

  describe('stats', () => {
    it('accounts for every element exactly once across the depths', () => {
      for (let i = 0; i < 200; i++) {
        tree.insert(makeItem((i % 20) * 7, Math.floor(i / 20) * 7, 3, 3));
      }
      const stats = tree.stats();
      const perDepth = stats.elementsByDepth.reduce((a, b) => a + b, 0);

      expect(stats.elements).toBe(queryAll().length);
      expect(perDepth).toBe(stats.elements);
      expect(stats.entriesByDepth.length).toBe(stats.maxDepth + 1);
    });

    it('counts leaves over capacity as saturated only where a split cannot help', () => {
      // Stacked at one point: the tree subdivides until the elements are too
      // large for any child of the cell they land in, where splitting stops
      // helping and the leaf grows past its capacity for good.
      for (let i = 0; i < 20; i++) tree.insert(makeItem(0, 0, 1, 1));
      const stats = tree.stats();

      expect(stats.leafOversize).toBe(20);
      expect(stats.overfullSplittableLeaves).toBe(0);
      expect(stats.saturatedLeaves).toBeGreaterThan(0);
    });

    it('tracks the occupied extent and the expansions it forced', () => {
      tree.insert(makeItem(10, 10, 5, 5));
      tree.insert(makeItem(500, 20, 5, 5));
      const stats = tree.stats();

      expect(stats.occupied).toEqual(new Rectangle(10, 10, 495, 15));
      expect(stats.root.size).toBe(64 * 2 ** stats.root.expansions);
      expect(stats.root.expansions).toBeGreaterThan(0);
    });
  });

  // ── cull ──────────────────────────────────────────────────────────────────

  describe('cull', () => {
    /** True if the item renders as culled, i.e. any ancestor entry is culled. */
    function isCulled(item: TestItem): boolean {
      for (let c: Container | null = item; c; c = c.parent) {
        if (c.culled) return true;
      }
      return false;
    }

    /** Inserts a 5-item cluster (forces a leaf split) around (x, y). */
    function insertCluster(x: number, y: number): TestItem[] {
      const items = [
        makeItem(x, y, 1, 1),
        makeItem(x + 2, y, 1, 1),
        makeItem(x, y + 2, 1, 1),
        makeItem(x + 2, y + 2, 1, 1),
        makeItem(x + 1, y + 1, 1, 1)
      ];
      for (const item of items) tree.insert(item);
      return items;
    }

    it('culls entries outside the view and keeps intersecting ones', () => {
      const near = insertCluster(2, 2);
      const far = insertCluster(40, 40);

      tree.cull(new Rectangle(0, 0, 10, 10));

      for (const item of near) expect(isCulled(item)).toBe(false);
      for (const item of far) expect(isCulled(item)).toBe(true);
    });

    it('culls everything when the view misses the whole tree', () => {
      const items = insertCluster(2, 2);

      tree.cull(new Rectangle(100, 100, 10, 10));

      for (const item of items) expect(isCulled(item)).toBe(true);
    });

    it('re-culling against a moved view reveals previously culled entries', () => {
      const near = insertCluster(2, 2);
      const far = insertCluster(40, 40);

      tree.cull(new Rectangle(0, 0, 10, 10));
      tree.cull(new Rectangle(38, 38, 10, 10));

      for (const item of far) expect(isCulled(item)).toBe(false);
      for (const item of near) expect(isCulled(item)).toBe(true);
    });

    it('a view covering everything culls nothing', () => {
      const near = insertCluster(2, 2);
      const far = insertCluster(40, 40);

      tree.cull(new Rectangle(0, 0, 10, 10));
      tree.cull(new Rectangle(0, 0, 64, 64));

      for (const item of [...near, ...far]) {
        expect(isCulled(item)).toBe(false);
      }
    });

    it('honors loose bounds: an item overhanging its cell is not culled away', () => {
      // Same shape as the loose-filing query test: the item's center puts it
      // in cells east of x=32, but its extent reaches back to x=31. A view
      // ending left of every cell must keep it visible.
      const poker = makeItem(31, 2, 2, 1); // center x=32
      tree.insert(poker);
      for (const c of [
        makeItem(33, 2, 1, 1),
        makeItem(33, 4, 1, 1),
        makeItem(35, 2, 1, 1),
        makeItem(35, 4, 1, 1)
      ]) {
        tree.insert(c);
      }

      tree.cull(new Rectangle(30, 0, 1.5, 10));
      expect(isCulled(poker)).toBe(false);
    });
  });
});
