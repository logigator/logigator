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

// Entries of this size and up are their own PixiJS render groups. A culled
// flip marks the nearest ancestor render group's instruction set dirty, and a
// dirty group rebuilds (and re-batches) in full — but instruction collection
// stops at child render groups, so grouping the upper strata keeps each
// rebuild bounded to one entry-sized region: the cull flips of viewport-edge
// entries during a pan re-batch a handful of elements, never the whole scene.
// Lowering the threshold shrinks the rebuild regions but raises the number of
// render groups, each of which breaks batching and adds fixed per-frame cost.
// The threshold compares the tight cell size, so the render-group population
// tracks the lattice, not the doubled loose bounds.
const RENDER_GROUP_MIN_SIZE = 32;

// A node in a loose quad tree (looseness factor 2): `region` is the tight
// cell of the quadrant lattice, while the container's boundsArea is that cell
// doubled in size and centered on it. Elements file by center point into the
// deepest cell at least as large as they are, so an element always lies
// within its entry's loose bounds, and a child's loose bounds nest inside its
// parent's — the containment guarantee query pruning and culling run on.
//
// Exported for the type-only import in `quad-tree-debug.ts`, not as an API of
// its own: an entry is reachable only through the tree that owns it.
export class QuadTreeEntry<T extends GridElement> extends Container {
  /** Elements too large for any child cell: wider or taller than half the region. */
  oversizeItems: Container<T> = this.addChild(new Container<T>());
  leafItems: Container<T> | null = this.addChild(new Container<T>());
  branches: Record<Quadrant, QuadTreeEntry<T>> | null = null;

  /** The tight cell: this entry's slot in the quadrant lattice. */
  readonly region: Rectangle;

  // Zoom scale this entry's elements were last tuned to, or null while it
  // holds none. The scale walk stops at culled entries, so an off-screen
  // entry's stamp falls behind the live zoom; the cull pass compares it and
  // catches the entry up on the frame that un-culls it.
  appliedScale: number | null = null;

  // The container itself always sits at position (0, 0) so that elements
  // reparented between entries never shift their world coordinates.
  //
  // The loose boundsArea also drives culling: QuadTreeContainer.cull() tests
  // it against the grid-space view rectangle and sets the plain PixiJS
  // `culled` flag at the entry level only. An on-screen entry renders all its
  // elements; an off-screen entry is culled whole and its subtree skipped —
  // both by the cull walk and at render time, where a culled render group
  // never executes. No element is ever bounds-checked.
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
 * quad tree: an entry accepts any element up to its own cell size whose
 * center lies in the cell, because its loose bounds cover the overhang. Only
 * an element's size decides how high it files — one sitting across a cell
 * boundary files just as deep as one in a cell's middle. Every element hangs
 * in exactly one entry, which is what lets the same tree double as the
 * render/cull hierarchy.
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

  // The zoom scale every element the tree holds is tuned to — the target the
  // per-entry stamps catch up to. See applyScale.
  private _appliedScale = 1;

  /**
   * Inserts an element into the quad tree.
   * @param element element to insert
   */
  public insert(element: T): void {
    // An arriving element carries whatever scale its previous host tuned it to
    // — a drag layer's, or a lagging off-screen entry's on a re-bucket — so
    // bring it to the live zoom before it can be drawn. Re-tuning an element
    // that is already current costs a cache lookup: both the context swap and
    // the transform writes it runs drop an unchanged value.
    element.applyScale(this._appliedScale);

    if (this._items.has(element)) {
      this.remove(element);
    }

    // File by cullBounds (usually == gridBounds) so an oversized element lands
    // in an entry large enough to wrap its full rendered extent, keeping it out
    // of the cull as long as any part is on screen. queryRange still tests the
    // tight gridBounds, so selection/collision are unaffected.
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
        // This is a branch, so we have to go deeper.
        entry = entry.branches[quadrantOf(entry.region, centerX, centerY)];
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
        throw new Error(
          'PANIC: Invalid Quad Tree state: entry has no branches but is not a leaf'
        );
      }
    }
  }

  /**
   * Whether the root can file an element: its cell must be at least the
   * element's size and contain the element's center — the loose bounds then
   * cover the element wherever in the cell that center lies. The interval is
   * closed: a center exactly on the far edge files into the last cell column,
   * whose loose bounds still cover the overhang.
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
   * Removes an element from the quad tree.
   * @param element element to remove, coordinates must match exactly
   * @returns true if the element was removed, false if it was not found
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
    for (const element of entry.oversizeItems.children) {
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
    // Prune by the loose bounds: an element in the subtree can overhang the
    // branch's cell, but never its loose bounds.
    const loose = branch.boundsArea;
    if (overlapsRect(range, loose.x, loose.y, loose.width, loose.height)) {
      this.collectRangeOfEntry(branch, range, out);
    }
  }

  /**
   * Culls entries against a view rectangle in grid coordinates: an entry
   * whose loose bounds miss the view gets its `culled` flag set and its
   * subtree skipped; intersecting branches recurse so their children are
   * re-tested. Pure rectangle math — the camera transform is folded into the
   * view rect by the caller once, never applied per entry.
   */
  public cull(view: Rectangle): void {
    this.cullEntry(this._tree, view);
  }

  private cullEntry(entry: QuadTreeEntry<T>, view: Rectangle): void {
    const culled = !view.intersects(entry.boundsArea);
    entry.culled = culled;
    if (culled) return;
    // On screen, so its elements must be current before the frame draws them.
    // This is where an entry the scale walk skipped while off-screen catches
    // up, whether zooming or panning brought it back into view.
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
   * Re-tunes the screen-constant visuals of every element the viewport can see
   * to `scale`, skipping culled entries: their elements keep the scale they
   * were last drawn at until {@link cull} brings them back on screen. Zoom
   * runs this per gesture step, and it is not cheap per element: re-tuning one
   * dirties its leaf transform, which PixiJS recomputes, and swaps its cached
   * context, which dirties its whole render group's instruction set. Skipping
   * the culled entries is what keeps a zoom step proportional to what is on
   * screen instead of to the size of the board.
   *
   * A tree nobody culls (an offscreen snapshot's project, a watch canvas) has
   * no culled entries, so the same walk covers all of it.
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

  /**
   * Expands the quad tree by doubling its size toward the given center.
   * @private
   */
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

    // The new root is a branch from birth, so it drops the leafItems container
    // every entry starts with; a branch keeps its elements in oversizeItems and
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
        // leafItems only ever holds elements a child cell can take — insert
        // files larger ones into oversizeItems.
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
      childrenCount += child.oversizeItems.children.length;
    }

    if (childrenCount < QuadTreeContainer.MIN_BRANCH_ELEMENTS) {
      entry.leafItems = entry.addChild(new Container<T>());
      // The absorbed children may have been culled, and so lagging behind the
      // live zoom, while this entry was on screen and current. Drop the stamp
      // so the next cull re-tunes the merged set instead of trusting it.
      entry.appliedScale = null;

      // Everything a child holds is at most the child's cell size — half this
      // entry's — so it all fits leafItems here.
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
  /**
   * Measures the live tree: its shape, where the elements sit in it, and how
   * far it drifted from the region it started with. Walks every entry, so it
   * is a debug-only call.
   */
  public stats(): QuadTreeStats {
    return collectQuadTreeStats(
      this._tree,
      this._items,
      QuadTreeContainer.LIMITS
    );
  }

  /**
   * Charts the distributions {@link stats} counts — the part of a measurement
   * that a bar reads better than an array. The scalar counts stay in the stats
   * object itself.
   * @param s measurement to chart; taken fresh when omitted
   */
  public formatDistributions(s = this.stats()): string {
    return formatQuadTreeDistributions(s);
  }

  /**
   * Draws the entry hierarchy as an indented text tree, one line per entry
   * with its region and occupancy. Subtrees below `maxDepth` collapse into a
   * single summary line.
   * @param maxDepth deepest level to expand
   */
  public formatTree(maxDepth = Infinity): string {
    return formatQuadTree(this._tree, maxDepth);
  }

  /**
   * Cross-checks the tree against its own invariants and returns one message
   * per problem — empty for a healthy tree. Catches the three states the
   * mutation paths panic on, a leaf a split should have relieved, and the
   * silent one they cannot see: an element that moved out of the region it is
   * filed under without being re-inserted.
   */
  public validate(): string[] {
    return validateQuadTree(this._tree, this._items, QuadTreeContainer.LIMITS);
  }
}
