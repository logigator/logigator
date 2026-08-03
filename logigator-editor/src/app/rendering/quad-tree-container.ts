import { Container, ContainerChild, Rectangle } from 'pixi.js';
import { GridElement } from './grid-element';
import { getStaticDI } from '../utils/get-di';
import { LoggingService } from '../logging/logging.service';
import { overlapsRect } from '../utils/grid';
import { formatIndexHistogram } from '../utils/histogram';

type Quadrant = 'nw' | 'ne' | 'sw' | 'se';

// Entries of this size and up are their own PixiJS render groups. A culled
// flip marks the nearest ancestor render group's instruction set dirty, and a
// dirty group rebuilds (and re-batches) in full — but instruction collection
// stops at child render groups, so grouping the upper strata keeps each
// rebuild bounded to one entry-sized region: the cull flips of viewport-edge
// entries during a pan re-batch a handful of elements, never the whole scene.
// Lowering the threshold shrinks the rebuild regions but raises the number of
// render groups, each of which breaks batching and adds fixed per-frame cost.
const RENDER_GROUP_MIN_SIZE = 32;

class QuadTreeEntry<T extends GridElement> extends Container {
  branchItems: Container<T> = this.addChild(new Container<T>());
  leafItems: Container<T> | null = this.addChild(new Container<T>());
  branches: Record<Quadrant, QuadTreeEntry<T>> | null = null;

  // x, y, size encode the spatial region via boundsArea.
  // The container itself always sits at position (0, 0) so that elements
  // reparented between entries never shift their world coordinates.
  //
  // The same region also drives culling: QuadTreeContainer.cull() tests it
  // against the grid-space view rectangle and sets the plain PixiJS `culled`
  // flag at the entry level only. An on-screen entry renders all its
  // elements; an off-screen entry is culled whole and its subtree skipped —
  // both by the cull walk and at render time, where a culled render group
  // never executes. No element is ever bounds-checked.
  constructor(x: number, y: number, size: number) {
    const region = new Rectangle(x, y, size, size);
    super({
      boundsArea: region,
      isRenderGroup: size >= RENDER_GROUP_MIN_SIZE
    });
  }

  get size() {
    return this.boundsArea.width;
  }
}

/** Shape and occupancy of a whole tree; see {@link QuadTreeContainer.stats}. */
export interface QuadTreeStats {
  /** Elements the tree tracks. */
  elements: number;
  entries: number;
  leaves: number;
  branches: number;
  /** Entries large enough to be their own PixiJS render group. */
  renderGroups: number;
  /** Leaves holding nothing — a large share means minifyBranch is not merging. */
  emptyLeaves: number;
  /** Entries the last cull pass flagged off-screen. */
  culledEntries: number;
  maxDepth: number;
  /** Depth of an average element: the levels a point query descends. */
  avgElementDepth: number;
  entriesByDepth: number[];
  elementsByDepth: number[];
  /**
   * Elements parked at a branch because they straddle its quadrant split, by
   * depth. Every range query passing through that branch tests all of them, so
   * the depth-0 count is paid by every query the tree ever answers.
   */
  branchStraddlersByDepth: number[];
  branchStraddlers: number;
  /**
   * Elements straddling the quadrant split of the leaf they sit in. A split
   * cannot move them, so they are what puts a leaf legitimately over capacity.
   */
  leafStraddlers: number;
  /** Leaf count indexed by how many elements the leaf holds. */
  leafOccupancy: number[];
  /**
   * Leaves whose splittable elements exceed the capacity at a size a split
   * could still relieve — an invariant violation.
   */
  overfullSplittableLeaves: number;
  /** Leaves over capacity that a split cannot relieve. */
  saturatedLeaves: number;
  /** Root region plus how often expand() doubled it past the initial size. */
  root: { x: number; y: number; size: number; expansions: number };
  /** Extent the elements actually occupy, or null while the tree is empty. */
  occupied: Rectangle | null;
  /** Fraction of the root region the occupied extent covers. */
  rootFill: number;
  thresholds: {
    maxLeafElements: number;
    minBranchElements: number;
    minLeafSize: number;
    initialSize: number;
    renderGroupMinSize: number;
  };
}

/** `x,y w×h` — the compact region form the debug output uses throughout. */
function describeRect(rect: Rectangle): string {
  return `${rect.x},${rect.y} ${rect.width}×${rect.height}`;
}

/** Element type plus grid footprint: enough to find it on the board. */
function describeElement(element: GridElement): string {
  return `${element.constructor.name} at ${describeRect(element.gridBounds)}`;
}

export class QuadTreeContainer<T extends GridElement> extends Container {
  private static readonly MAX_LEAF_ELEMENTS = 4;
  private static readonly MIN_BRANCH_ELEMENTS = 2;
  private static readonly INITIAL_SIZE = 64;
  private static readonly MIN_LEAF_SIZE = 1;

  private _tree = super.addChild(
    new QuadTreeEntry<T>(0, 0, QuadTreeContainer.INITIAL_SIZE)
  );
  private _items = new Map<T, QuadTreeEntry<T>>();

  /**
   * Inserts an element into the quad tree.
   * @param element element to insert
   */
  public insert(element: T): void {
    if (this._items.has(element)) {
      this.remove(element);
    }

    // File by cullBounds (usually == gridBounds) so an oversized element lands
    // in an entry large enough to wrap its full rendered extent, keeping it out
    // of the cull as long as any part is on screen. queryRange still tests the
    // tight gridBounds, so selection/collision are unaffected.
    const elBounds = element.cullBounds;

    while (!this._tree.boundsArea.containsRect(elBounds)) {
      this.expand(elBounds);
    }

    for (let entry = this._tree; ;) {
      const quadrant = this.getContainingQuadrant(entry.boundsArea, elBounds);
      if (!quadrant) {
        entry.branchItems.addChild(element);
        this._items.set(element, entry);
        return;
      }

      if (entry.branches) {
        // This is a branch, so we have to go deeper.
        entry = entry.branches[quadrant];
      } else if (entry.leafItems) {
        // This is a leaf, so we have to check if we can insert the element here or if we have to split the leaf.
        if (
          entry.leafItems.children.length >=
            QuadTreeContainer.MAX_LEAF_ELEMENTS &&
          entry.size >= QuadTreeContainer.MIN_LEAF_SIZE * 2
        ) {
          entry = this.splitLeaf(entry);
          continue;
        }

        entry.leafItems.addChild(element);
        this._items.set(element, entry);
        return;
      } else {
        getStaticDI(LoggingService).error(
          `insert reached an entry (size ${entry.size}) with neither branches nor leafItems; element bounds ${JSON.stringify(elBounds)}`,
          'QuadTreeContainer'
        );
        throw new Error(
          'PANIC: Invalid Quad Tree state: entry has no branches but is not a leaf'
        );
      }
    }
  }

  /**
   * Removes an element from the quad tree.
   * @param element element to remove, coordinates must match exactly
   * @returns true if the element was removed, false if it was not found
   */
  public remove(element: T): boolean {
    const entry = this._items.get(element);
    if (!entry) return false;

    if (entry.branchItems.children.includes(element)) {
      entry.branchItems.removeChild(element);
    } else if (entry.leafItems?.children.includes(element)) {
      entry.leafItems.removeChild(element);
    } else {
      getStaticDI(LoggingService).error(
        `remove found the element in _items but in neither branchItems nor leafItems of its entry (size ${entry.size})`,
        'QuadTreeContainer'
      );
      throw new Error(
        'PANIC: Invalid Quad Tree state: element was found in hashmap but not in tree'
      );
    }

    if (entry.parent !== this)
      this.minifyBranch(entry.parent as QuadTreeEntry<T>);
    this._items.delete(element);
    return true;
  }

  /**
   * Returns an iterator over all elements contained in the quad tree.
   */
  public get items() {
    return this._items.keys();
  }

  /**
   * Blocked — use {@link insert} instead. Direct addChild() calls bypass
   * _items tracking and would cause elements to render but never appear in
   * queryRange or items.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  override addChild<U extends ContainerChild[]>(...args: U): U[0] {
    throw new Error(
      'QuadTreeContainer: use insert() to add elements; addChild() bypasses spatial indexing.'
    );
  }

  /**
   * Appends every element whose bounds intersect `range` to `out` and returns
   * it. Elements that only partially overlap the range are included.
   *
   * Deliberately an array rather than a generator: a `yield*` recursion costs a
   * generator frame per visited entry and pushes every result back up the whole
   * delegation chain, which on a deep tree outweighs the per-element tests the
   * walk exists to perform. The result being a snapshot also lets callers
   * mutate the tree while iterating it.
   * @param range rectangle defining the range to query
   * @param out array to append to; pass a reused one to avoid allocating
   */
  public queryRange(range: Rectangle, out: T[] = []): T[] {
    this.collectRangeOfEntry(this._tree, range, out);
    return out;
  }

  private collectRangeOfEntry(
    entry: QuadTreeEntry<T>,
    range: Rectangle,
    out: T[]
  ): void {
    for (const element of entry.branchItems.children) {
      if (element.intersectsGridBounds(range)) out.push(element);
    }

    const branches = entry.branches;
    if (branches) {
      // Named access, not Object.values: that allocates a four-element array on
      // every visited entry. `cull` already walks the quadrants this way.
      this.collectBranch(branches.nw, range, out);
      this.collectBranch(branches.ne, range, out);
      this.collectBranch(branches.sw, range, out);
      this.collectBranch(branches.se, range, out);
    } else {
      for (const element of entry.leafItems!.children) {
        if (element.intersectsGridBounds(range)) out.push(element);
      }
    }
  }

  private collectBranch(
    branch: QuadTreeEntry<T>,
    range: Rectangle,
    out: T[]
  ): void {
    const region = branch.boundsArea;
    if (overlapsRect(range, region.x, region.y, region.width, region.height)) {
      this.collectRangeOfEntry(branch, range, out);
    }
  }

  /**
   * Culls entries against a view rectangle in grid coordinates: an entry
   * whose region misses the view gets its `culled` flag set and its subtree
   * skipped; intersecting branches recurse so their children are re-tested.
   * Pure rectangle math — the camera transform is folded into the view rect
   * by the caller once, never applied per entry.
   */
  public cull(view: Rectangle): void {
    this.cullEntry(this._tree, view);
  }

  private cullEntry(entry: QuadTreeEntry<T>, view: Rectangle): void {
    const culled = !view.intersects(entry.boundsArea);
    entry.culled = culled;
    if (culled || !entry.branches) return;
    this.cullEntry(entry.branches.nw, view);
    this.cullEntry(entry.branches.ne, view);
    this.cullEntry(entry.branches.sw, view);
    this.cullEntry(entry.branches.se, view);
  }

  /**
   * Expands the quad tree by doubling its size.
   * @private
   */
  private expand(targetBounds: Rectangle): void {
    const oldBounds = this._tree.boundsArea;
    const expandLeft = targetBounds.x < oldBounds.x;
    const expandUp = targetBounds.y < oldBounds.y;
    const newX = expandLeft ? oldBounds.x - oldBounds.width : oldBounds.x;
    const newY = expandUp ? oldBounds.y - oldBounds.height : oldBounds.y;

    const newRoot = super.addChild(
      new QuadTreeEntry<T>(newX, newY, oldBounds.width * 2)
    );

    const nwEntry = new QuadTreeEntry<T>(newX, newY, oldBounds.width);
    const neEntry = new QuadTreeEntry<T>(
      newX + oldBounds.width,
      newY,
      oldBounds.width
    );
    const swEntry = new QuadTreeEntry<T>(
      newX,
      newY + oldBounds.height,
      oldBounds.width
    );
    const seEntry = new QuadTreeEntry<T>(
      newX + oldBounds.width,
      newY + oldBounds.height,
      oldBounds.width
    );

    // The old tree occupies the quadrant opposite the expansion direction
    // so its spatial bounds remain unchanged within the new root.
    if (!expandLeft && !expandUp) {
      newRoot.branches = {
        nw: newRoot.addChild(this._tree),
        ne: newRoot.addChild(neEntry),
        sw: newRoot.addChild(swEntry),
        se: newRoot.addChild(seEntry)
      };
    } else if (expandLeft && !expandUp) {
      newRoot.branches = {
        nw: newRoot.addChild(nwEntry),
        ne: newRoot.addChild(this._tree),
        sw: newRoot.addChild(swEntry),
        se: newRoot.addChild(seEntry)
      };
    } else if (!expandLeft && expandUp) {
      newRoot.branches = {
        nw: newRoot.addChild(nwEntry),
        ne: newRoot.addChild(neEntry),
        sw: newRoot.addChild(this._tree),
        se: newRoot.addChild(seEntry)
      };
    } else {
      newRoot.branches = {
        nw: newRoot.addChild(nwEntry),
        ne: newRoot.addChild(neEntry),
        sw: newRoot.addChild(swEntry),
        se: newRoot.addChild(this._tree)
      };
    }

    // The new root is a branch from birth, so it drops the leafItems container
    // every entry starts with; a branch keeps its elements in branchItems and
    // minifyBranch re-creates the container if the root ever collapses back.
    newRoot.removeChild(newRoot.leafItems!);
    newRoot.leafItems = null;

    this.minifyBranch(newRoot);
    this._tree = newRoot;
  }

  /**
   * Converts the leaf into a branch and distributes the elements of the leaf into the children of the branch.
   * @private
   */
  private splitLeaf(entry: QuadTreeEntry<T>): QuadTreeEntry<T> {
    if (!entry.leafItems) {
      throw new Error('PANIC: Trying to split a non-leaf');
    }

    const b = entry.boundsArea;
    const half = b.width / 2;

    entry.branches = {
      nw: entry.addChild(new QuadTreeEntry<T>(b.x, b.y, half)),
      ne: entry.addChild(new QuadTreeEntry<T>(b.x + half, b.y, half)),
      sw: entry.addChild(new QuadTreeEntry<T>(b.x, b.y + half, half)),
      se: entry.addChild(new QuadTreeEntry<T>(b.x + half, b.y + half, half))
    };

    for (const element of [...entry.leafItems.children]) {
      const elBounds = element.cullBounds;
      const quadrant = this.getContainingQuadrant(entry.boundsArea, elBounds);
      if (!quadrant) {
        getStaticDI(LoggingService).error(
          `splitLeaf: leaf element with bounds ${JSON.stringify(elBounds)} is not contained in any quadrant of entry ${JSON.stringify(entry.boundsArea)}`,
          'QuadTreeContainer'
        );
        throw new Error(
          'PANIC: Invalid Quad Tree state: leaf element is not contained in any quadrant'
        );
      }

      const quadrantInner = this.getContainingQuadrant(
        entry.branches[quadrant].boundsArea,
        elBounds
      );

      if (quadrantInner) {
        entry.branches[quadrant].leafItems!.addChild(element);
      } else {
        entry.branches[quadrant].branchItems.addChild(element);
      }

      this._items.set(element, entry.branches[quadrant]);
    }

    entry.removeChild(entry.leafItems);
    entry.leafItems = null;
    return entry;
  }

  /**
   * Merges leafs together whenever the parent branch has less than MIN_BRANCH_ELEMENTS branch elements.
   * @param entry
   * @private
   */
  private minifyBranch(entry: QuadTreeEntry<T>): number {
    if (!entry.branches) throw new Error('PANIC: Trying to minify a leaf');

    let childrenCount = 0;
    for (const child of Object.values(entry.branches)) {
      if (child.branches) {
        childrenCount += this.minifyBranch(child);
      } else {
        childrenCount += child.leafItems!.children.length;
      }
      childrenCount += child.branchItems.children.length;
    }

    if (childrenCount < QuadTreeContainer.MIN_BRANCH_ELEMENTS) {
      entry.leafItems = entry.addChild(new Container<T>());

      for (const child of Object.values(entry.branches)) {
        for (const element of [...child.branchItems.children]) {
          this._items.set(element, entry);
          entry.leafItems.addChild(element);
        }
        if (child.leafItems) {
          for (const element of [...child.leafItems.children]) {
            this._items.set(element, entry);
            entry.leafItems.addChild(element);
          }
        }
        entry.removeChild(child);
      }

      entry.branches = null;
    }

    return childrenCount;
  }

  /**
   * Measures the live tree: its shape, where the elements sit in it, and how
   * far it drifted from the region it started with. Walks every entry, so it
   * is a debug-only call.
   */
  public stats(): QuadTreeStats {
    const root = this._tree.boundsArea;
    const stats: QuadTreeStats = {
      elements: this._items.size,
      entries: 0,
      leaves: 0,
      branches: 0,
      renderGroups: 0,
      emptyLeaves: 0,
      culledEntries: 0,
      maxDepth: 0,
      avgElementDepth: 0,
      entriesByDepth: [],
      elementsByDepth: [],
      branchStraddlersByDepth: [],
      branchStraddlers: 0,
      leafStraddlers: 0,
      leafOccupancy: [],
      overfullSplittableLeaves: 0,
      saturatedLeaves: 0,
      root: {
        x: root.x,
        y: root.y,
        size: root.width,
        expansions: Math.round(
          Math.log2(root.width / QuadTreeContainer.INITIAL_SIZE)
        )
      },
      occupied: this.occupiedExtent(),
      rootFill: 0,
      thresholds: {
        maxLeafElements: QuadTreeContainer.MAX_LEAF_ELEMENTS,
        minBranchElements: QuadTreeContainer.MIN_BRANCH_ELEMENTS,
        minLeafSize: QuadTreeContainer.MIN_LEAF_SIZE,
        initialSize: QuadTreeContainer.INITIAL_SIZE,
        renderGroupMinSize: RENDER_GROUP_MIN_SIZE
      }
    };

    this.collectStats(this._tree, 0, stats);

    let depthSum = 0;
    for (let depth = 0; depth < stats.elementsByDepth.length; depth++) {
      depthSum += depth * (stats.elementsByDepth[depth] ?? 0);
    }
    stats.avgElementDepth = stats.elements > 0 ? depthSum / stats.elements : 0;
    if (stats.occupied) {
      stats.rootFill =
        (stats.occupied.width * stats.occupied.height) /
        (root.width * root.height);
    }
    return stats;
  }

  private collectStats(
    entry: QuadTreeEntry<T>,
    depth: number,
    stats: QuadTreeStats
  ): void {
    stats.entries++;
    stats.maxDepth = Math.max(stats.maxDepth, depth);
    stats.entriesByDepth[depth] = (stats.entriesByDepth[depth] ?? 0) + 1;
    stats.elementsByDepth[depth] ??= 0;
    stats.branchStraddlersByDepth[depth] ??= 0;
    if (entry.size >= RENDER_GROUP_MIN_SIZE) stats.renderGroups++;
    if (entry.culled) stats.culledEntries++;

    const straddlers = entry.branchItems.children.length;
    if (entry.branches) {
      // Elements too wide for any quadrant park here, and every range query
      // that passes through the entry on its way down tests each of them.
      stats.branches++;
      stats.branchStraddlers += straddlers;
      stats.branchStraddlersByDepth[depth] += straddlers;
      stats.elementsByDepth[depth] += straddlers;
      this.collectStats(entry.branches.nw, depth + 1, stats);
      this.collectStats(entry.branches.ne, depth + 1, stats);
      this.collectStats(entry.branches.sw, depth + 1, stats);
      this.collectStats(entry.branches.se, depth + 1, stats);
      return;
    }

    stats.leaves++;
    const filed = entry.leafItems!.children.length;
    const held = straddlers + filed;
    stats.leafStraddlers += straddlers;
    stats.elementsByDepth[depth] += held;
    stats.leafOccupancy[held] = (stats.leafOccupancy[held] ?? 0) + 1;
    if (held === 0) stats.emptyLeaves++;
    if (held > QuadTreeContainer.MAX_LEAF_ELEMENTS) {
      if (this.isOverfullSplittable(entry)) {
        stats.overfullSplittableLeaves++;
      } else {
        stats.saturatedLeaves++;
      }
    }
  }

  /**
   * Whether a leaf holds more splittable elements than its capacity at a size a
   * split could still relieve. Splitting only redistributes the elements a
   * quadrant can hold, so a leaf over capacity through straddlers, or one
   * already at the minimum size, is legitimately over it instead.
   */
  private isOverfullSplittable(entry: QuadTreeEntry<T>): boolean {
    return (
      !entry.branches &&
      entry.leafItems!.children.length > QuadTreeContainer.MAX_LEAF_ELEMENTS &&
      entry.size >= QuadTreeContainer.MIN_LEAF_SIZE * 2
    );
  }

  /** Union of every element's cullBounds, or null while the tree is empty. */
  private occupiedExtent(): Rectangle | null {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const element of this._items.keys()) {
      const b = element.cullBounds;
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.right > maxX) maxX = b.right;
      if (b.bottom > maxY) maxY = b.bottom;
    }
    if (!Number.isFinite(minX)) return null;
    return new Rectangle(minX, minY, maxX - minX, maxY - minY);
  }

  /**
   * Charts the distributions {@link stats} counts — the part of a measurement
   * that a bar reads better than an array. The scalar counts stay in the stats
   * object itself.
   * @param s measurement to chart; taken fresh when omitted
   */
  public formatDistributions(s = this.stats()): string {
    return [
      ...formatIndexHistogram('entries by depth', s.entriesByDepth),
      '',
      ...formatIndexHistogram('elements by depth', s.elementsByDepth),
      '',
      ...formatIndexHistogram(
        'branch straddlers by depth (query-cost multiplier)',
        s.branchStraddlersByDepth
      ),
      '',
      ...formatIndexHistogram('leaves by element count', s.leafOccupancy)
    ].join('\n');
  }

  /**
   * Draws the entry hierarchy as an indented text tree, one line per entry
   * with its region and occupancy. Subtrees below `maxDepth` collapse into a
   * single summary line.
   * @param maxDepth deepest level to expand
   */
  public formatTree(maxDepth = Infinity): string {
    const lines: string[] = [];
    this.formatEntry(this._tree, 0, '', '', '', maxDepth, lines);
    return lines.join('\n');
  }

  /**
   * @param prefix guides plus the connector for this entry's own line
   * @param indent guides its children's connectors hang off
   */
  private formatEntry(
    entry: QuadTreeEntry<T>,
    depth: number,
    label: string,
    prefix: string,
    indent: string,
    maxDepth: number,
    lines: string[]
  ): void {
    const b = entry.boundsArea;
    const straddlers = entry.branchItems.children.length;
    const parts = [`${prefix}${label}[${b.x},${b.y} size ${b.width}]`];
    if (entry.branches) {
      parts.push('branch');
    } else {
      parts.push(`leaf ${straddlers + entry.leafItems!.children.length}`);
    }
    if (straddlers > 0) parts.push(`${straddlers} straddling`);
    if (entry.culled) parts.push('culled');
    lines.push(parts.join(' '));

    if (!entry.branches) return;
    if (depth >= maxDepth) {
      const below = this.subtreeTotals(entry);
      lines.push(
        `${indent}└─ … ${below.entries - 1} entries below, ${below.elements} elements`
      );
      return;
    }

    const quadrants = ['nw', 'ne', 'sw', 'se'] as const;
    quadrants.forEach((quadrant, index) => {
      const last = index === quadrants.length - 1;
      this.formatEntry(
        entry.branches![quadrant],
        depth + 1,
        `${quadrant} `,
        `${indent}${last ? '└─ ' : '├─ '}`,
        `${indent}${last ? '   ' : '│  '}`,
        maxDepth,
        lines
      );
    });
  }

  /** Entry and element totals of the subtree rooted at `entry`, inclusive. */
  private subtreeTotals(entry: QuadTreeEntry<T>): {
    entries: number;
    elements: number;
  } {
    let entries = 1;
    let elements = entry.branchItems.children.length;
    if (entry.branches) {
      for (const child of Object.values(entry.branches)) {
        const below = this.subtreeTotals(child);
        entries += below.entries;
        elements += below.elements;
      }
    } else {
      elements += entry.leafItems!.children.length;
    }
    return { entries, elements };
  }

  /**
   * Cross-checks the tree against its own invariants and returns one message
   * per problem — empty for a healthy tree. Catches the three states the
   * mutation paths panic on, a leaf a split should have relieved, and the silent
   * one they cannot see: an element that moved out of the region it is filed
   * under without being re-inserted.
   */
  public validate(): string[] {
    const problems: string[] = [];
    const seen = new Set<T>();

    for (const [element, entry] of this._items) {
      const inBranch = entry.branchItems.children.includes(element);
      const inLeaf = entry.leafItems?.children.includes(element) ?? false;
      const where = `element ${describeElement(element)} filed under entry [${describeRect(entry.boundsArea)}]`;
      if (!inBranch && !inLeaf) {
        problems.push(`${where} sits in neither branchItems nor leafItems`);
        continue;
      }
      if (!entry.boundsArea.containsRect(element.cullBounds)) {
        problems.push(
          `${where} has cullBounds ${describeRect(element.cullBounds)} outside that region — it moved without being re-inserted`
        );
      }
      if (
        inBranch &&
        entry.branches &&
        this.getContainingQuadrant(entry.boundsArea, element.cullBounds)
      ) {
        problems.push(`${where} fits a quadrant and belongs one level deeper`);
      }
    }

    this.validateEntry(this._tree, seen, problems);
    for (const element of seen) {
      if (!this._items.has(element)) {
        problems.push(
          `element ${describeElement(element)} hangs in the tree but is missing from the item map`
        );
      }
    }
    if (seen.size !== this._items.size) {
      problems.push(
        `item map holds ${this._items.size} elements, the tree holds ${seen.size}`
      );
    }
    return problems;
  }

  private validateEntry(
    entry: QuadTreeEntry<T>,
    seen: Set<T>,
    problems: string[]
  ): void {
    const region = describeRect(entry.boundsArea);
    if (entry.branches && entry.leafItems) {
      problems.push(`entry [${region}] has both branches and leafItems`);
    }
    if (!entry.branches && !entry.leafItems) {
      problems.push(`entry [${region}] has neither branches nor leafItems`);
    }
    if (this.isOverfullSplittable(entry)) {
      problems.push(
        `leaf [${region}] holds ${entry.leafItems!.children.length} contained elements over the capacity of ${QuadTreeContainer.MAX_LEAF_ELEMENTS} at a size a split could still relieve`
      );
    }

    const children = [
      ...entry.branchItems.children,
      ...(entry.leafItems?.children ?? [])
    ];
    for (const element of children) {
      if (seen.has(element)) {
        problems.push(
          `element ${describeElement(element)} hangs in the tree twice`
        );
      }
      seen.add(element);
      if (this._items.get(element) !== entry) {
        problems.push(
          `element ${describeElement(element)} hangs under entry [${region}] but the item map points elsewhere`
        );
      }
    }

    if (!entry.branches) return;
    const b = entry.boundsArea;
    const half = b.width / 2;
    const expected: Record<Quadrant, [number, number]> = {
      nw: [b.x, b.y],
      ne: [b.x + half, b.y],
      sw: [b.x, b.y + half],
      se: [b.x + half, b.y + half]
    };
    for (const [quadrant, [x, y]] of Object.entries(expected) as [
      Quadrant,
      [number, number]
    ][]) {
      const child = entry.branches[quadrant];
      const cb = child.boundsArea;
      if (cb.x !== x || cb.y !== y || cb.width !== half) {
        problems.push(
          `entry [${region}] has a ${quadrant} branch at [${describeRect(cb)}] instead of [${x},${y} ${half}×${half}]`
        );
      }
      this.validateEntry(child, seen, problems);
    }
  }

  /**
   * Returns the quadrant of the entry that contains the item rectangle, or null if the item rectangle is not fully contained in any quadrant.
   * @param bounds Rectangle defining the bounds of the entry
   * @param itemRect Rectangle defining the bounds of the item
   * @private
   */
  private getContainingQuadrant(
    bounds: Rectangle,
    itemRect: Rectangle
  ): Quadrant | null {
    if (
      new Rectangle(
        bounds.x,
        bounds.y,
        bounds.width / 2,
        bounds.height / 2
      ).containsRect(itemRect)
    ) {
      return 'nw';
    } else if (
      new Rectangle(
        bounds.x + bounds.width / 2,
        bounds.y,
        bounds.width / 2,
        bounds.height / 2
      ).containsRect(itemRect)
    ) {
      return 'ne';
    } else if (
      new Rectangle(
        bounds.x,
        bounds.y + bounds.height / 2,
        bounds.width / 2,
        bounds.height / 2
      ).containsRect(itemRect)
    ) {
      return 'sw';
    } else if (
      new Rectangle(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
        bounds.width / 2,
        bounds.height / 2
      ).containsRect(itemRect)
    ) {
      return 'se';
    } else {
      return null;
    }
  }
}
