import { beforeEach, describe, expect, it } from 'vitest';
import { Container, Rectangle } from 'pixi.js';
import { QuadTreeContainer, QuadTreeEntry } from './quad-tree-container';
import { GridElement } from './grid-element';
import { arrayWithExactContents } from '../../testing/vitest-helpers';

/**
 * `appliedScale` and `textHidden` record what the tree last tuned the item to;
 * `tunings` counts the calls, so a spec can tell an entry skipped as current
 * from one re-tuned to the same values.
 */
type TestItem = Container &
  GridElement & { appliedScale: number; textHidden: boolean; tunings: number };

/** What a leaf holds before the next arrival splits it. */
const CAPACITY = QuadTreeContainer.LIMITS.maxLeafElements;

describe('QuadTreeContainer', () => {
  let tree: QuadTreeContainer<TestItem>;

  beforeEach(() => {
    tree = new QuadTreeContainer<TestItem>();
  });

  function track(c: TestItem): void {
    c.appliedScale = 1;
    c.textHidden = false;
    c.tunings = 0;
    c.applyScale = (scale) => {
      c.appliedScale = scale;
      c.tunings++;
    };
    c.setTextHidden = (hidden) => {
      c.textHidden = hidden;
      c.tunings++;
    };
  }

  /** Creates a Container with a fixed grid-space rectangle (x, y, w, h). */
  function makeItem(x: number, y: number, w: number, h: number): TestItem {
    const c = new Container({ position: { x, y } }) as TestItem;
    const bounds = {
      get(this: TestItem) {
        return new Rectangle(this.position.x, this.position.y, w, h);
      }
    };
    Object.defineProperty(c, 'gridBounds', bounds);
    Object.defineProperty(c, 'pickBounds', bounds);
    Object.defineProperty(c, 'cullBounds', bounds);
    // Both mirrors must agree with the box they answer for, which is the
    // contract the tree relies on.
    c.intersectsGridBounds = (rect) => rect.intersects(c.gridBounds);
    c.intersectsPickBounds = (rect) => rect.intersects(c.pickBounds);
    track(c);
    return c;
  }

  /**
   * An item drawn beyond its footprint, like a text label: the footprint is
   * what it collides by, the pick box the drawn overflow a click can land on,
   * and what it files by covers both.
   */
  function makeOverflowingItem(
    x: number,
    y: number,
    pickWidth: number
  ): TestItem {
    const c = new Container({ position: { x, y } }) as TestItem;
    const box = (width: number) => ({
      get(this: TestItem) {
        return new Rectangle(this.position.x, this.position.y, width, 1);
      }
    });
    Object.defineProperty(c, 'gridBounds', box(1));
    Object.defineProperty(c, 'pickBounds', box(pickWidth));
    Object.defineProperty(c, 'cullBounds', box(pickWidth));
    c.intersectsGridBounds = (rect) => rect.intersects(c.gridBounds);
    c.intersectsPickBounds = (rect) => rect.intersects(c.pickBounds);
    track(c);
    return c;
  }

  /**
   * Inserts one more unit item than a leaf holds, five to a row from (x, y),
   * so the cluster alone forces a leaf split.
   */
  function insertCluster(x: number, y: number): TestItem[] {
    const items = Array.from({ length: CAPACITY + 1 }, (_, i) =>
      makeItem(x + (i % 5), y + Math.floor(i / 5), 1, 1)
    );
    for (const item of items) tree.insert(item);
    return items;
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
      const items = [
        makeItem(2, 2, 3, 3),
        makeItem(20, 20, 3, 3),
        makeItem(40, 40, 3, 3)
      ];
      for (const c of items) tree.insert(c);

      expect(queryAll()).toEqual(arrayWithExactContents(items));
    });

    it('items placed in different quadrants are all returned (pre-split)', () => {
      // Four items stay in the root leaf: no split.
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

      // The NW half: initial size 64, midline 32.
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

    it('leaf splits when more items than it holds accumulate in the same area and all are still returned', () => {
      const items = Array.from({ length: CAPACITY + 1 }, (_, i) =>
        makeItem(i * 2, i * 2, 1, 1)
      );
      for (const c of items) tree.insert(c);

      expect(queryAll()).toEqual(arrayWithExactContents(items));
    });
  });

  describe('pick bounds', () => {
    it('finds an element by its pick bounds beyond its footprint', () => {
      const item = makeOverflowingItem(0, 0, 10);
      tree.insert(item);

      // The drawn overflow is a query target of its own — this is what makes a
      // click on a text label reach the text at all — while the element's own
      // footprint still answers no overlap for the same rect.
      const overflow = new Rectangle(5, 0, 1, 1);
      expect(tree.queryRange(overflow)).toContain(item);
      expect(item.gridBounds.intersects(overflow)).toBe(false);
    });
  });

  describe('oversize items and loose filing', () => {
    // The initial tree spans (0, 0, 64, 64). An element files into a child
    // only if its max dimension is at most half the entry; larger ones park in
    // oversizeItems. Position never parks an element high.

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
      // The range ends at x=4, the item at x=42: they overlap x:2-4.
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
      // Items across the x=32 midline force splits along their column.
      const crossers = Array.from({ length: CAPACITY + 1 }, (_, i) =>
        makeItem(31, 2 + i, 2, 1)
      );
      for (const c of crossers) tree.insert(c);

      expect(tree.stats().branchOversize).toBe(1); // the wide item, nothing else
      expect(tree.validate()).toEqual([]);
      expect(queryAll()).toEqual(arrayWithExactContents([wide, ...crossers]));
    });

    it('query pruning honors loose bounds: an item overhanging its cell is found', () => {
      // Every center sits east of the x=32 midline, but the first item's
      // extent reaches back to x=31; a query left of every cell must find it.
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
      const items = Array.from({ length: CAPACITY + 1 }, (_, i) =>
        makeItem(i * 2, i * 2, 1, 1)
      );
      for (const c of items) tree.insert(c);

      for (const c of items.slice(1)) tree.remove(c);

      expect(queryAll()).toEqual([items[0]]);
    });

    it('multi-level compaction: remaining item is still retrievable after a two-level split collapses', () => {
      // Root NW is (0,0,32,32) with 16x16 sub-quadrants. One NE item and a
      // leaf's worth of NW items split the root, one more splits NW; the NW
      // items spread across all four sub-quadrants, each holding fewer than a
      // leaf, so the tree stays exactly two levels deep.
      const ne = makeItem(40, 2, 3, 3);
      const corners = [
        [2, 2],
        [18, 2],
        [2, 18],
        [18, 18]
      ] as const;
      const nw = Array.from({ length: CAPACITY + 1 }, (_, i) => {
        const [x, y] = corners[i % 4];
        return makeItem(x + Math.floor(i / 4), y, 1, 1);
      });

      tree.insert(ne);
      for (const c of nw) tree.insert(c);

      tree.remove(ne);
      for (const c of nw.slice(1)) tree.remove(c);

      expect(queryAll()).toEqual([nw[0]]);
    });
  });

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

  // queryRange/insert operate on gridBounds, which are independent of the
  // scene graph: panning the parent must not affect query results.

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
      // A pan leaking into grid coords would put the item at (510, 310).
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

  describe('validate', () => {
    /** Inserts, moves and removes enough elements to split, expand and minify. */
    function churn(): TestItem[] {
      const items: TestItem[] = [];
      for (let i = 0; i < 200; i++) {
        const c = makeItem((i % 20) * 7, Math.floor(i / 20) * 7, 3, 3);
        items.push(c);
        tree.insert(c);
      }
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
      // Expansion stacks ancestors above the entries without re-filing, so an
      // element parked deep below the new root still validates: its size class
      // matches its entry regardless of what hangs above.
      tree.insert(makeItem(2, 20, 40, 5)); // maxDim 40 > 32: parks at the root
      for (let i = 0; i < CAPACITY + 4; i++) {
        tree.insert(makeItem(i * 2, i, 3, 3));
      }
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
      // Stacked at one point, the tree subdivides until the elements exceed
      // any child cell and splitting stops helping.
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

  describe('cull', () => {
    /** True if the item renders as culled, i.e. any ancestor entry is culled. */
    function isCulled(item: TestItem): boolean {
      for (let c: Container | null = item; c; c = c.parent) {
        if (c.culled) return true;
      }
      return false;
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
      // Clear of the near group's loose bounds, which reach x = y = 48.
      tree.cull(new Rectangle(50, 50, 10, 10));

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
      // The center files it east of x=32 but its extent reaches back to x=31,
      // so a view ending left of every cell must keep it visible.
      const poker = makeItem(31, 2, 2, 1); // center x=32
      tree.insert(poker);
      // Enough company east of the midline to split the root into groups.
      for (let i = 0; i < CAPACITY; i++) {
        tree.insert(makeItem(33 + (i % 5), 4 + Math.floor(i / 5), 1, 1));
      }

      tree.cull(new Rectangle(30, 0, 1.5, 10));
      expect(isCulled(poker)).toBe(false);
    });
  });

  describe('setBoardScale', () => {
    it('re-tunes nothing itself; the next cull tunes each visible element once, to the last scale', () => {
      const near = insertCluster(2, 2);
      tree.cull(new Rectangle(0, 0, 10, 10));
      for (const item of near) item.tunings = 0;

      // Three zoom steps inside one frame.
      tree.setBoardScale(1.2);
      tree.setBoardScale(1.44);
      tree.setBoardScale(1.728);
      for (const item of near) expect(item.tunings).toBe(0);

      tree.cull(new Rectangle(0, 0, 10, 10));
      for (const item of near) {
        expect(item.tunings).toBe(1);
        expect(item.appliedScale).toBe(1.728);
      }
    });

    it('re-tunes on-screen elements and leaves culled ones behind', () => {
      const near = insertCluster(2, 2);
      const far = insertCluster(40, 40);
      tree.cull(new Rectangle(0, 0, 10, 10));

      tree.setBoardScale(2);
      tree.cull(new Rectangle(0, 0, 10, 10));

      for (const item of near) expect(item.appliedScale).toBe(2);
      for (const item of far) expect(item.appliedScale).toBe(1);
    });

    it('catches a culled element up on the cull that reveals it', () => {
      const far = insertCluster(40, 40);
      tree.cull(new Rectangle(0, 0, 10, 10));
      tree.setBoardScale(2);
      tree.cull(new Rectangle(0, 0, 10, 10));

      tree.cull(new Rectangle(38, 38, 10, 10));

      for (const item of far) expect(item.appliedScale).toBe(2);
    });

    it('re-tunes a revealed entry only once while the scale holds', () => {
      const [item] = insertCluster(40, 40);
      tree.cull(new Rectangle(0, 0, 10, 10));
      tree.setBoardScale(2);
      tree.cull(new Rectangle(0, 0, 10, 10));
      tree.cull(new Rectangle(38, 38, 10, 10));

      const calls: number[] = [];
      item.applyScale = (scale) => calls.push(scale);
      tree.cull(new Rectangle(38, 38, 10, 10));

      expect(calls).toEqual([]);
    });

    it('brings an inserted element to the live scale', () => {
      tree.setBoardScale(2);
      tree.cull(new Rectangle(0, 0, 64, 64));

      const item = makeItem(5, 5, 1, 1);
      tree.insert(item);

      expect(item.appliedScale).toBe(2);
    });

    it('re-tunes an element a merge pulls out of a culled entry', () => {
      // A leaf's worth in nw, one in se. The view misses se's loose bounds, so
      // that element lags the scale; emptying nw then collapses the branches
      // and merges the lagging element into a root whose stamp says current.
      const near = Array.from({ length: CAPACITY }, (_, i) =>
        makeItem(2 + (i % 5), 2 + Math.floor(i / 5), 1, 1)
      );
      const far = makeItem(40, 40, 1, 1);
      for (const item of [...near, far]) tree.insert(item);
      tree.cull(new Rectangle(0, 0, 10, 10));
      tree.setBoardScale(2);
      tree.cull(new Rectangle(0, 0, 10, 10));
      expect(far.appliedScale).toBe(1);

      for (const item of near) tree.remove(item);
      tree.cull(new Rectangle(0, 0, 64, 64));

      expect(far.appliedScale).toBe(2);
    });
  });

  describe('presentation', () => {
    const SNAPSHOT = { scale: 0.25, textHidden: true };
    const isCulled = (item: TestItem): boolean => {
      for (let c: Container | null = item; c; c = c.parent) {
        if (c.culled) return true;
      }
      return false;
    };
    const inSnapshot = (item: TestItem) =>
      item.appliedScale === SNAPSHOT.scale && item.textHidden;
    const onBoard = (item: TestItem, scale = 1) =>
      item.appliedScale === scale && !item.textHidden;
    const resetTunings = (items: TestItem[]) => {
      for (const item of items) item.tunings = 0;
    };

    it('present un-culls and tunes every entry, culled ones included', () => {
      const near = insertCluster(2, 2);
      const far = insertCluster(40, 40);
      tree.cull(new Rectangle(0, 0, 10, 10));

      tree.present(SNAPSHOT);

      for (const item of [...near, ...far]) {
        expect(isCulled(item)).toBe(false);
        expect(inSnapshot(item)).toBe(true);
      }
    });

    it('a cull returns only on-screen entries to the board; the rest keep the snapshot', () => {
      const near = insertCluster(2, 2);
      const far = insertCluster(40, 40);
      tree.setBoardScale(2);
      tree.cull(new Rectangle(0, 0, 64, 64));

      tree.present(SNAPSHOT);
      tree.cull(new Rectangle(0, 0, 10, 10));

      for (const item of near) expect(onBoard(item, 2)).toBe(true);
      for (const item of far) expect(inSnapshot(item)).toBe(true);

      // Panning there later catches them up to the board's zoom.
      tree.cull(new Rectangle(38, 38, 10, 10));
      for (const item of far) expect(onBoard(item, 2)).toBe(true);
    });

    it('a repeated snapshot re-tunes only what the viewport returned to the board', () => {
      const near = insertCluster(2, 2);
      const far = insertCluster(40, 40);
      tree.present(SNAPSHOT);
      tree.cull(new Rectangle(0, 0, 10, 10));
      resetTunings([...near, ...far]);

      tree.present(SNAPSHOT);

      for (const item of far) expect(item.tunings).toBe(0);
      for (const item of near) expect(inSnapshot(item)).toBe(true);
    });

    it('touches only the half of the stamp that differs', () => {
      const [item] = insertCluster(2, 2);
      resetTunings([item]);
      tree.present({ scale: 1, textHidden: true });

      expect(item.textHidden).toBe(true);
      // The scale already matched, so only the text flip ran.
      expect(item.tunings).toBe(1);
    });

    it('insert tunes an element to the state of the entry it lands in', () => {
      insertCluster(40, 40);
      tree.present(SNAPSHOT);
      tree.cull(new Rectangle(0, 0, 10, 10));

      const offScreen = makeItem(41, 41, 1, 1);
      const onScreen = makeItem(3, 3, 1, 1);
      tree.insert(offScreen);
      tree.insert(onScreen);

      expect(inSnapshot(offScreen)).toBe(true);
      expect(onBoard(onScreen)).toBe(true);
      // Both stamps stay truthful: the next snapshot need not touch either.
      resetTunings([offScreen]);
      tree.present(SNAPSHOT);
      expect(offScreen.tunings).toBe(0);
    });

    it('a leaf split hands its stamp to the children it fills', () => {
      // A near cluster splits the root, so the far items fill a leaf of their
      // own that the view below leaves culled.
      insertCluster(2, 2);
      const items = Array.from({ length: CAPACITY }, (_, i) =>
        makeItem(40 + (i % 5), 40 + Math.floor(i / 5), 1, 1)
      );
      for (const item of items) tree.insert(item);
      tree.present(SNAPSHOT);
      tree.cull(new Rectangle(0, 0, 10, 10));

      // One more overflows the leaf and splits it.
      const fifth = makeItem(45, 45, 1, 1);
      tree.insert(fifth);
      resetTunings(items);

      tree.present(SNAPSHOT);

      for (const item of items) expect(item.tunings).toBe(0);
      expect(inSnapshot(fifth)).toBe(true);
    });

    it('a merge of elements that agree keeps the stamp, one that disagrees drops it', () => {
      // A leaf's worth in nw, one in se; the snapshot leaves se behind.
      const near = Array.from({ length: CAPACITY }, (_, i) =>
        makeItem(2 + (i % 5), 2 + Math.floor(i / 5), 1, 1)
      );
      const far = makeItem(40, 40, 1, 1);
      for (const item of [...near, far]) tree.insert(item);
      tree.present(SNAPSHOT);
      tree.cull(new Rectangle(0, 0, 10, 10));
      expect(inSnapshot(far)).toBe(true);

      // Emptying nw collapses the branches around the lagging element: the
      // merged stamp cannot vouch for it, so the next visit re-tunes it.
      for (const item of near) tree.remove(item);
      tree.cull(new Rectangle(0, 0, 64, 64));
      expect(onBoard(far)).toBe(true);
    });

    it('expanding keeps the old tree in the state it was left in', () => {
      const far = insertCluster(40, 40);
      tree.present(SNAPSHOT);
      tree.cull(new Rectangle(0, 0, 10, 10));

      // Far outside the 64-unit root, so the tree grows around the old one.
      const outlier = makeItem(500, 500, 1, 1);
      tree.insert(outlier);
      resetTunings(far);

      tree.present(SNAPSHOT);

      for (const item of far) expect(item.tunings).toBe(0);
      expect(inSnapshot(outlier)).toBe(true);
    });

    it('detach returns an element to the board, whatever its entry was left in', () => {
      const far = insertCluster(40, 40);
      tree.setBoardScale(2);
      tree.cull(new Rectangle(0, 0, 64, 64));
      tree.present(SNAPSHOT);
      tree.cull(new Rectangle(0, 0, 10, 10));

      tree.detach(far[0]);

      expect(onBoard(far[0], 2)).toBe(true);
      expect([...tree.items]).not.toContain(far[0]);
    });

    it('uncull un-culls in the board presentation', () => {
      const far = insertCluster(40, 40);
      tree.present(SNAPSHOT);
      tree.cull(new Rectangle(0, 0, 10, 10));

      tree.uncull();

      for (const item of far) {
        expect(isCulled(item)).toBe(false);
        expect(onBoard(item)).toBe(true);
      }
    });
  });

  describe('render-group granularity', () => {
    const SNAPSHOT = { scale: 0.25, textHidden: true };
    const isCulled = (item: TestItem): boolean => {
      for (let c: Container | null = item; c; c = c.parent) {
        if (c.culled) return true;
      }
      return false;
    };
    /** The entries an item hangs under, nearest first. */
    const entriesOf = (item: TestItem): QuadTreeEntry<TestItem>[] => {
      const out: QuadTreeEntry<TestItem>[] = [];
      for (let c: Container | null = item.parent; c; c = c.parent) {
        if (c instanceof QuadTreeEntry) out.push(c as QuadTreeEntry<TestItem>);
      }
      return out;
    };
    const inSnapshot = (item: TestItem) =>
      item.appliedScale === SNAPSHOT.scale && item.textHidden;
    const onBoard = (item: TestItem, scale = 1) =>
      item.appliedScale === scale && !item.textHidden;

    /**
     * A 10×10 lattice of unit items inside the 32-unit cell at (x0, y0),
     * dense enough to split that cell's group well below the group size.
     */
    function fillGroup(x0: number, y0: number): TestItem[] {
      const items: TestItem[] = [];
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
          const item = makeItem(x0 + 1 + i * 3, y0 + 1 + j * 3, 1, 1);
          tree.insert(item);
          items.push(item);
        }
      }
      return items;
    }

    it('never culls an entry below a render group, whatever the view misses', () => {
      insertCluster(2, 2);
      const group = fillGroup(32, 32);
      expect(group.some((item) => entriesOf(item)[0].size < 16)).toBe(true);

      // One corner of the group is on screen; most of its sub-entries are not.
      tree.cull(new Rectangle(33, 33, 2, 2));

      for (const item of group) {
        expect(isCulled(item)).toBe(false);
        for (const entry of entriesOf(item)) {
          if (!entry.isGroupRoot) expect(entry.culled).toBe(false);
        }
      }
    });

    it('a zoom re-tunes all of a visible group, off-screen sub-entries included', () => {
      const near = insertCluster(2, 2);
      const group = fillGroup(32, 32);
      tree.cull(new Rectangle(60, 60, 2, 2));

      tree.setBoardScale(2);
      tree.cull(new Rectangle(60, 60, 2, 2));

      for (const item of group) expect(item.appliedScale).toBe(2);
      for (const item of near) expect(item.appliedScale).toBe(1);
    });

    it('one stamp covers a culled group through inserts, a split and merges below it', () => {
      insertCluster(2, 2);
      const group = fillGroup(32, 32);
      tree.present(SNAPSHOT);
      tree.cull(new Rectangle(0, 0, 4, 4));
      expect(group.every((item) => isCulled(item))).toBe(true);

      // Into a deep leaf of the culled group: it takes the group's state.
      const arrival = makeItem(34, 35, 1, 1);
      tree.insert(arrival);
      expect(inSnapshot(arrival)).toBe(true);

      // A leaf's worth in one sub-cell splits it; the stamp still holds.
      const packed = Array.from({ length: CAPACITY }, (_, i) =>
        makeItem(50 + (i % 4) * 0.5, 50 + Math.floor(i / 4) * 0.5, 0.25, 0.25)
      );
      for (const item of packed) tree.insert(item);
      const all = [...group, arrival, ...packed];
      for (const item of all) item.tunings = 0;
      tree.present(SNAPSHOT);
      for (const item of all) expect(item.tunings).toBe(0);

      // Emptying most of it merges sub-entries back; still nothing to redo.
      const kept = all.filter((_, i) => i % 9 === 0);
      for (const item of all) if (!kept.includes(item)) tree.remove(item);
      tree.present(SNAPSHOT);
      for (const item of kept) expect(item.tunings).toBe(0);
      expect(tree.validate()).toEqual([]);

      // Coming on screen returns the lot to the board in one catch-up.
      tree.cull(new Rectangle(32, 32, 32, 32));
      for (const item of kept) expect(onBoard(item)).toBe(true);
    });

    it('nested groups keep their own stamps', () => {
      // Wider than a 32-unit child, so it parks at the 64-unit root group.
      const wide = makeItem(2, 30, 40, 1);
      tree.insert(wide);
      const near = insertCluster(2, 2);
      const far = insertCluster(40, 40);
      tree.present(SNAPSHOT);

      tree.cull(new Rectangle(0, 0, 10, 10));

      // The root is on screen, so its own element returns; its child groups
      // answer for themselves.
      expect(onBoard(wide)).toBe(true);
      for (const item of near) expect(onBoard(item)).toBe(true);
      for (const item of far) expect(inSnapshot(item)).toBe(true);
    });
  });
});
