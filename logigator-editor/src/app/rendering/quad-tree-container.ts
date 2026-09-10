import { Container, ContainerChild, Rectangle } from 'pixi.js';
import { GridElement } from './grid-element';
import { overlapsRect } from '../utils/grid';
import {
  collectQuadTreeStats,
  formatQuadTree,
  formatQuadTreeDistributions,
  QuadTreeLimits,
  QuadTreeStats,
  validateQuadTree
} from './quad-tree-debug';

export type Quadrant = 'nw' | 'ne' | 'sw' | 'se';

// Entries this size and up are their own render group, so a cull flip
// rebuilds one entry-sized region instead of the whole scene. Lower means
// smaller rebuilds but more groups, each breaking batching. Tight cell size.
const RENDER_GROUP_MIN_SIZE = 32;

// A node in a loose quad tree (looseness 2): `region` is the tight lattice
// cell, `boundsArea` that cell doubled and centered on it. Elements file by
// center point into the deepest cell at least as large as they are, so an
// element always lies within its entry's loose bounds and a child's loose
// bounds nest inside its parent's — the containment guarantee query pruning
// and culling run on.
export class QuadTreeEntry<T extends GridElement> extends Container {
  /** Elements too large for any child cell: wider or taller than half the region. */
  oversizeItems: Container<T> = this.addChild(new Container<T>());
  leafItems: Container<T> | null = this.addChild(new Container<T>());
  branches: Record<Quadrant, QuadTreeEntry<T>> | null = null;

  /** The tight cell: this entry's slot in the quadrant lattice. */
  readonly region: Rectangle;

  // Zoom scale this entry's elements were last tuned to, or null while it
  // holds none. The scale walk stops at culled entries, so the cull pass
  // compares this stamp and catches a lagging entry up when it un-culls.
  appliedScale: number | null = null;

  // Stays at position (0, 0) so elements reparented between entries never
  // shift their world coordinates. The loose boundsArea also drives culling,
  // which flips `culled` at entry level only — no element is bounds-checked.
  constructor(x: number, y: number, size: number) {
    super({
      boundsArea: new Rectangle(x - size / 2, y - size / 2, size * 2, size * 2),
      isRenderGroup: size >= RENDER_GROUP_MIN_SIZE
    });
    this.region = new Rectangle(x, y, size, size);
  }

  get size() {
    return this.region.width;
  }
}

/** Center-point quadrant pick; ties on a midline go east/south. */
function quadrantOf(region: Rectangle, cx: number, cy: number): Quadrant {
  const midX = region.x + region.width / 2;
  const midY = region.y + region.height / 2;
  if (cy < midY) {
    return cx < midX ? 'nw' : 'ne';
  }
  return cx < midX ? 'sw' : 'se';
}

/**
 * Spatial index and scene-graph host for the board's elements, as a loose
 * quad tree: an entry accepts any element up to its own cell size whose center
 * lies in the cell, because its loose bounds cover the overhang. Only size
 * decides how high an element files. Every element hangs in exactly one entry,
 * which is what lets the tree double as the render/cull hierarchy.
 */
export class QuadTreeContainer<T extends GridElement> extends Container {
  private static readonly MAX_LEAF_ELEMENTS = 4;
  private static readonly MIN_BRANCH_ELEMENTS = 2;
  private static readonly INITIAL_SIZE = 64;
  private static readonly MIN_LEAF_SIZE = 1;

  /** The tuning numbers the reports in `quad-tree-debug.ts` read. */
  private static readonly LIMITS: QuadTreeLimits = {
    maxLeafElements: QuadTreeContainer.MAX_LEAF_ELEMENTS,
    minBranchElements: QuadTreeContainer.MIN_BRANCH_ELEMENTS,
    minLeafSize: QuadTreeContainer.MIN_LEAF_SIZE,
    initialSize: QuadTreeContainer.INITIAL_SIZE,
    renderGroupMinSize: RENDER_GROUP_MIN_SIZE
  };

  private _tree = super.addChild(
    new QuadTreeEntry<T>(0, 0, QuadTreeContainer.INITIAL_SIZE)
  );
  private _items = new Map<T, QuadTreeEntry<T>>();

  // Target zoom scale the per-entry stamps catch up to. See applyScale.
  private _appliedScale = 1;

  /** Inserts an element into the quad tree. */
  public insert(element: T): void {
    // An arriving element carries whatever scale its previous host tuned it
    // to. Re-tuning one already current costs only a cache lookup.
    element.applyScale(this._appliedScale);

    if (this._items.has(element)) {
      this.remove(element);
    }

    // File by cullBounds so an element lands in an entry wrapping its full
    // rendered extent. queryRange still tests the tight gridBounds.
    const elBounds = element.cullBounds;
    const elSize = Math.max(elBounds.width, elBounds.height);
    const centerX = elBounds.x + elBounds.width / 2;
    const centerY = elBounds.y + elBounds.height / 2;

    while (!this.rootAccepts(elSize, centerX, centerY)) {
      this.expand(centerX, centerY);
    }

    for (let entry = this._tree; ;) {
      if (elSize > entry.size / 2) {
        // Too large for any child cell: this entry's size class is the
        // element's, wherever in the cell its center lies.
        entry.oversizeItems.addChild(element);
        this._items.set(element, entry);
        return;
      }

      if (entry.branches) {
        entry = entry.branches[quadrantOf(entry.region, centerX, centerY)];
      } else if (entry.leafItems) {
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
        throw new Error(
          'PANIC: Invalid Quad Tree state: entry has no branches but is not a leaf'
        );
      }
    }
  }

  /**
   * Whether the root can file an element: its cell must be at least the
   * element's size and contain the element's center. The interval is closed —
   * a center on the far edge files into the last cell column, whose loose
   * bounds still cover the overhang.
   */
  private rootAccepts(elSize: number, cx: number, cy: number): boolean {
    const region = this._tree.region;
    return (
      elSize <= region.width &&
      cx >= region.x &&
      cx <= region.right &&
      cy >= region.y &&
      cy <= region.bottom
    );
  }

  /**
   * Removes an element from the quad tree; false when it was not found.
   * Coordinates must match exactly.
   */
  public remove(element: T): boolean {
    const entry = this._items.get(element);
    if (!entry) return false;

    if (entry.oversizeItems.children.includes(element)) {
      entry.oversizeItems.removeChild(element);
    } else if (entry.leafItems?.children.includes(element)) {
      entry.leafItems.removeChild(element);
    } else {
      throw new Error(
        'PANIC: Invalid Quad Tree state: element was found in hashmap but not in tree'
      );
    }

    if (entry.parent !== this)
      this.minifyBranch(entry.parent as QuadTreeEntry<T>);
    this._items.delete(element);
    return true;
  }

  /** Iterator over every element in the quad tree. */
  public get items() {
    return this._items.keys();
  }

  /**
   * Blocked — use {@link insert}. A direct addChild() bypasses `_items`, so
   * the element would render but never appear in queryRange or items.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  override addChild<U extends ContainerChild[]>(...args: U): U[0] {
    throw new Error(
      'QuadTreeContainer: use insert() to add elements; addChild() bypasses spatial indexing.'
    );
  }

  /**
   * Appends every element whose bounds intersect `range` to `out`, partial
   * overlaps included, and returns it.
   *
   * An array rather than a generator: `yield*` recursion costs a frame per
   * visited entry and re-pushes every result up the delegation chain. The
   * snapshot also lets callers mutate the tree while iterating.
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
    for (const element of entry.oversizeItems.children) {
      if (element.intersectsGridBounds(range)) out.push(element);
    }

    const branches = entry.branches;
    if (branches) {
      // Named access, not Object.values: that allocates an array per entry.
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
    // Prune by the loose bounds: an element in the subtree can overhang the
    // branch's cell, but never its loose bounds.
    const loose = branch.boundsArea;
    if (overlapsRect(range, loose.x, loose.y, loose.width, loose.height)) {
      this.collectRangeOfEntry(branch, range, out);
    }
  }

  /**
   * Culls entries against a view rectangle in grid coordinates: an entry whose
   * loose bounds miss the view is culled and its subtree skipped. Pure
   * rectangle math — the camera transform is folded into the view rect once.
   */
  public cull(view: Rectangle): void {
    this.cullEntry(this._tree, view);
  }

  private cullEntry(entry: QuadTreeEntry<T>, view: Rectangle): void {
    const culled = !view.intersects(entry.boundsArea);
    entry.culled = culled;
    if (culled) return;
    // On screen, so an entry the scale walk skipped while off-screen catches
    // up before the frame draws it.
    if (entry.appliedScale !== this._appliedScale) {
      this.applyScaleToItems(entry, this._appliedScale);
    }
    if (!entry.branches) return;
    this.cullEntry(entry.branches.nw, view);
    this.cullEntry(entry.branches.ne, view);
    this.cullEntry(entry.branches.sw, view);
    this.cullEntry(entry.branches.se, view);
  }

  /**
   * Re-tunes the screen-constant visuals of every visible element to `scale`,
   * skipping culled entries until {@link cull} brings them back. Re-tuning one
   * element dirties its transform and swaps its cached context, dirtying its
   * whole render group's instruction set, so skipping the culled entries is
   * what keeps a zoom step proportional to what is on screen. A tree nobody
   * culls has no culled entries, so the same walk covers all of it.
   */
  public applyScale(scale: number): void {
    this._appliedScale = scale;
    this.applyScaleToEntry(this._tree, scale, true);
  }

  /**
   * Re-tunes every element regardless of culling. For renders that draw the
   * whole board un-culled (see `uncullTree`), where the visible-only walk
   * would leave off-screen elements at a foreign scale.
   */
  public applyScaleToAll(scale: number): void {
    this._appliedScale = scale;
    this.applyScaleToEntry(this._tree, scale, false);
  }

  private applyScaleToEntry(
    entry: QuadTreeEntry<T>,
    scale: number,
    skipCulled: boolean
  ): void {
    if (skipCulled && entry.culled) return;
    this.applyScaleToItems(entry, scale);
    const branches = entry.branches;
    if (!branches) return;
    this.applyScaleToEntry(branches.nw, scale, skipCulled);
    this.applyScaleToEntry(branches.ne, scale, skipCulled);
    this.applyScaleToEntry(branches.sw, scale, skipCulled);
    this.applyScaleToEntry(branches.se, scale, skipCulled);
  }

  private applyScaleToItems(entry: QuadTreeEntry<T>, scale: number): void {
    for (const element of entry.oversizeItems.children) {
      element.applyScale(scale);
    }
    if (entry.leafItems) {
      for (const element of entry.leafItems.children) {
        element.applyScale(scale);
      }
    }
    entry.appliedScale = scale;
  }

  /** Doubles the tree's size toward the given center. */
  private expand(centerX: number, centerY: number): void {
    const oldRegion = this._tree.region;
    const expandLeft = centerX < oldRegion.x;
    const expandUp = centerY < oldRegion.y;
    const newX = expandLeft ? oldRegion.x - oldRegion.width : oldRegion.x;
    const newY = expandUp ? oldRegion.y - oldRegion.height : oldRegion.y;

    const newRoot = super.addChild(
      new QuadTreeEntry<T>(newX, newY, oldRegion.width * 2)
    );

    const nwEntry = new QuadTreeEntry<T>(newX, newY, oldRegion.width);
    const neEntry = new QuadTreeEntry<T>(
      newX + oldRegion.width,
      newY,
      oldRegion.width
    );
    const swEntry = new QuadTreeEntry<T>(
      newX,
      newY + oldRegion.height,
      oldRegion.width
    );
    const seEntry = new QuadTreeEntry<T>(
      newX + oldRegion.width,
      newY + oldRegion.height,
      oldRegion.width
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

    // A branch from birth, so it drops the leafItems container every entry
    // starts with; minifyBranch re-creates it if the root collapses back.
    newRoot.removeChild(newRoot.leafItems!);
    newRoot.leafItems = null;

    this.minifyBranch(newRoot);
    this._tree = newRoot;
  }

  /** Converts a leaf into a branch, redistributing its elements. */
  private splitLeaf(entry: QuadTreeEntry<T>): QuadTreeEntry<T> {
    if (!entry.leafItems) {
      throw new Error('PANIC: Trying to split a non-leaf');
    }

    const b = entry.region;
    const half = b.width / 2;

    entry.branches = {
      nw: entry.addChild(new QuadTreeEntry<T>(b.x, b.y, half)),
      ne: entry.addChild(new QuadTreeEntry<T>(b.x + half, b.y, half)),
      sw: entry.addChild(new QuadTreeEntry<T>(b.x, b.y + half, half)),
      se: entry.addChild(new QuadTreeEntry<T>(b.x + half, b.y + half, half))
    };

    for (const element of [...entry.leafItems.children]) {
      const elBounds = element.cullBounds;
      const elSize = Math.max(elBounds.width, elBounds.height);
      if (elSize > half) {
        // leafItems only ever holds elements a child cell can take.
        throw new Error(
          'PANIC: Invalid Quad Tree state: leaf element is too large for a child cell'
        );
      }

      const child =
        entry.branches[
          quadrantOf(
            b,
            elBounds.x + elBounds.width / 2,
            elBounds.y + elBounds.height / 2
          )
        ];

      if (elSize > half / 2) {
        child.oversizeItems.addChild(element);
      } else {
        child.leafItems!.addChild(element);
      }

      this._items.set(element, child);
    }

    entry.removeChild(entry.leafItems);
    entry.leafItems = null;
    return entry;
  }

  /** Merges leaves back whenever a branch holds < MIN_BRANCH_ELEMENTS. */
  private minifyBranch(entry: QuadTreeEntry<T>): number {
    if (!entry.branches) throw new Error('PANIC: Trying to minify a leaf');

    let childrenCount = 0;
    for (const child of Object.values(entry.branches)) {
      if (child.branches) {
        childrenCount += this.minifyBranch(child);
      } else {
        childrenCount += child.leafItems!.children.length;
      }
      childrenCount += child.oversizeItems.children.length;
    }

    if (childrenCount < QuadTreeContainer.MIN_BRANCH_ELEMENTS) {
      entry.leafItems = entry.addChild(new Container<T>());
      // Absorbed children may have been culled, so lagging behind the live
      // zoom. Drop the stamp so the next cull re-tunes the merged set.
      entry.appliedScale = null;

      // A child holds nothing larger than half this entry's cell, so it all
      // fits leafItems here.
      for (const child of Object.values(entry.branches)) {
        for (const element of [...child.oversizeItems.children]) {
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
  /** Measures the live tree. Walks every entry, so debug-only. */
  public stats(): QuadTreeStats {
    return collectQuadTreeStats(
      this._tree,
      this._items,
      QuadTreeContainer.LIMITS
    );
  }

  /**
   * Charts the distributions {@link stats} counts; the scalar counts stay in
   * the stats object.
   * @param s measurement to chart; taken fresh when omitted
   */
  public formatDistributions(s = this.stats()): string {
    return formatQuadTreeDistributions(s);
  }

  /**
   * Draws the entry hierarchy as an indented text tree, one line per entry
   * with its region and occupancy. Subtrees below `maxDepth` collapse.
   */
  public formatTree(maxDepth = Infinity): string {
    return formatQuadTree(this._tree, maxDepth);
  }

  /**
   * Cross-checks the tree against its invariants, one message per problem.
   * Also catches the silent failure the mutation paths cannot see: an element
   * that moved out of the region it is filed under without being re-inserted.
   */
  public validate(): string[] {
    return validateQuadTree(this._tree, this._items, QuadTreeContainer.LIMITS);
  }
}
