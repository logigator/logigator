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
// It is also the cull granularity: only these entries are culled and stamped.
const RENDER_GROUP_MIN_SIZE = 32;

/**
 * How an entry's elements are tuned: the zoom scale their screen-constant
 * visuals follow, and whether their text is hidden. The board shows its live
 * zoom with text; a snapshot asks for its own pair. Compared by value.
 */
export interface Presentation {
  readonly scale: number;
  readonly textHidden: boolean;
}

function samePresentation(a: Presentation | null, b: Presentation): boolean {
  return a !== null && a.scale === b.scale && a.textHidden === b.textHidden;
}

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

  // On a group root (see isGroupRoot): what every element in its group is
  // tuned to — its own and those of the entries below it down to the next
  // group root — or null when they may disagree (a merge absorbed groups in
  // different states). The zoom walk stops at culled groups and a snapshot
  // leaves off-screen ones in its own state, so the cull pass compares this
  // stamp against the board's and catches a group up as it comes on screen.
  // Always null below a group root, whose elements its group's stamp covers.
  presentation: Presentation | null;

  // Stays at position (0, 0) so elements reparented between entries never
  // shift their world coordinates. The loose boundsArea also drives culling,
  // which flips `culled` on group roots only — no element is bounds-checked.
  constructor(
    x: number,
    y: number,
    size: number,
    presentation: Presentation | null
  ) {
    super({
      boundsArea: new Rectangle(x - size / 2, y - size / 2, size * 2, size * 2),
      isRenderGroup: size >= RENDER_GROUP_MIN_SIZE
    });
    this.region = new Rectangle(x, y, size, size);
    this.presentation = this.isGroupRoot ? presentation : null;
  }

  get size() {
    return this.region.width;
  }

  /**
   * Whether this entry roots a render group — and so is the unit culling and
   * the presentation stamps work in. Entries below one are never culled: a
   * flip there rebuilds the whole containing group anyway, so culling finer
   * saves only drawing the off-screen part of a group partly on screen, which
   * the GPU clips, and it made the cull walk visit every entry of a
   * zoomed-out board on every frame. The root is never smaller than
   * `INITIAL_SIZE`, so every entry has a group root at or above it.
   */
  get isGroupRoot(): boolean {
    return this.size >= RENDER_GROUP_MIN_SIZE;
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
  private static readonly MAX_LEAF_ELEMENTS = 16;
  private static readonly MIN_BRANCH_ELEMENTS = 8;
  private static readonly INITIAL_SIZE = 64;
  private static readonly MIN_LEAF_SIZE = 1;

  /** The tuning numbers the reports in `quad-tree-debug.ts` read. */
  public static readonly LIMITS: QuadTreeLimits = {
    maxLeafElements: QuadTreeContainer.MAX_LEAF_ELEMENTS,
    minBranchElements: QuadTreeContainer.MIN_BRANCH_ELEMENTS,
    minLeafSize: QuadTreeContainer.MIN_LEAF_SIZE,
    initialSize: QuadTreeContainer.INITIAL_SIZE,
    renderGroupMinSize: RENDER_GROUP_MIN_SIZE
  };

  // The board's presentation — live zoom, text shown — that the per-entry
  // stamps catch up to on screen. See applyScale and cull.
  private _board: Presentation = { scale: 1, textHidden: false };

  private _tree = super.addChild(
    new QuadTreeEntry<T>(0, 0, QuadTreeContainer.INITIAL_SIZE, this._board)
  );
  private _items = new Map<T, QuadTreeEntry<T>>();

  /** Inserts an element into the quad tree. */
  public insert(element: T): void {
    if (this._items.has(element)) {
      this.remove(element);
    }

    // File by cullBounds so an element lands in an entry wrapping its full
    // rendered extent. queryRange tests the pickBounds, which stay inside it —
    // a text label is clickable where it is drawn, not only on its anchor cell.
    const elBounds = element.cullBounds;
    const elSize = Math.max(elBounds.width, elBounds.height);
    const centerX = elBounds.x + elBounds.width / 2;
    const centerY = elBounds.y + elBounds.height / 2;

    while (!this.rootAccepts(elSize, centerX, centerY)) {
      this.expand(centerX, centerY);
    }

    let group = this._tree;
    for (let entry = this._tree; ;) {
      if (entry.isGroupRoot) group = entry;
      if (elSize > entry.size / 2) {
        // Too large for any child cell: this entry's size class is the
        // element's, wherever in the cell its center lies.
        this.presentElement(element, group);
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

        this.presentElement(element, group);
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

  /**
   * Removes an element that lives on outside the tree — a drag session's
   * ghost — returning it to the board's presentation first. An element taken
   * from an entry a snapshot left in its own state would otherwise be dragged
   * at the snapshot's scale with its text hidden. Plain {@link remove} skips
   * this: a removed element is destroyed or re-inserted, and insert syncs it.
   */
  public detach(element: T): boolean {
    const entry = this._items.get(element);
    if (!entry) return false;
    const stamp = this.groupOf(entry).presentation;
    this.remove(element);
    if (!samePresentation(stamp, this._board)) {
      this.presentElement(element, null);
    }
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
      if (element.intersectsPickBounds(range)) out.push(element);
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
        if (element.intersectsPickBounds(range)) out.push(element);
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
   * Culls group roots against a view rectangle in grid coordinates: one whose
   * loose bounds miss the view is culled and its subtree skipped. Entries
   * below a group root are left unculled (see {@link QuadTreeEntry.isGroupRoot}),
   * so the walk ends there. Pure rectangle math — the camera transform is
   * folded into the view rect once.
   */
  public cull(view: Rectangle): void {
    this.cullEntry(this._tree, view);
  }

  private cullEntry(entry: QuadTreeEntry<T>, view: Rectangle): void {
    const culled = !view.intersects(entry.boundsArea);
    entry.culled = culled;
    if (culled) return;
    // On screen, so a group the zoom walk skipped or a snapshot left behind
    // catches up before the frame draws it.
    this.presentGroup(entry, this._board);
    const branches = entry.branches;
    if (!branches || !branches.nw.isGroupRoot) return;
    this.cullEntry(branches.nw, view);
    this.cullEntry(branches.ne, view);
    this.cullEntry(branches.sw, view);
    this.cullEntry(branches.se, view);
  }

  /**
   * Re-tunes the screen-constant visuals of every visible group to `scale`,
   * skipping culled groups until {@link cull} brings them back. Re-tuning one
   * element dirties its transform and swaps its cached context, dirtying its
   * whole render group's instruction set, so skipping the culled groups is
   * what keeps a zoom step proportional to what is on screen. A tree nobody
   * culls has no culled groups, so the same walk covers all of it.
   */
  public applyScale(scale: number): void {
    this._board = { scale, textHidden: false };
    this.applyScaleToEntry(this._tree);
  }

  private applyScaleToEntry(entry: QuadTreeEntry<T>): void {
    if (entry.culled) return;
    this.presentGroup(entry, this._board);
    const branches = entry.branches;
    if (!branches || !branches.nw.isGroupRoot) return;
    this.applyScaleToEntry(branches.nw);
    this.applyScaleToEntry(branches.ne);
    this.applyScaleToEntry(branches.sw);
    this.applyScaleToEntry(branches.se);
  }

  /**
   * Un-culls every group and tunes it to `presentation`, for a render that
   * draws the whole tree against no viewport (a snapshot). Only groups not
   * already in that state are touched, and the board's own presentation is
   * left as it is: {@link cull} returns what comes on screen to it, and a
   * group that stays off-screen keeps the snapshot's state — with its render
   * group's instruction set — for the next snapshot to find current.
   */
  public present(presentation: Presentation): void {
    this.presentEntry(this._tree, presentation);
  }

  /**
   * Un-culls every group in the board's presentation, for a render with no
   * cull pass of its own (a watch canvas).
   */
  public uncull(): void {
    this.presentEntry(this._tree, this._board);
  }

  private presentEntry(
    entry: QuadTreeEntry<T>,
    presentation: Presentation
  ): void {
    entry.culled = false;
    this.presentGroup(entry, presentation);
    const branches = entry.branches;
    if (!branches || !branches.nw.isGroupRoot) return;
    this.presentEntry(branches.nw, presentation);
    this.presentEntry(branches.ne, presentation);
    this.presentEntry(branches.sw, presentation);
    this.presentEntry(branches.se, presentation);
  }

  /**
   * Brings a group root's elements — its own and those below it down to the
   * next group root — to `presentation`, touching only the half of it that
   * differs from the stamp: a scale change swaps contexts, a text flip is a
   * structural change, and neither is free.
   */
  private presentGroup(
    group: QuadTreeEntry<T>,
    presentation: Presentation
  ): void {
    const stamp = group.presentation;
    if (samePresentation(stamp, presentation)) return;
    const rescale = stamp === null || stamp.scale !== presentation.scale;
    const retext =
      stamp === null || stamp.textHidden !== presentation.textHidden;
    this.tuneGroupItems(group, presentation, rescale, retext);
    group.presentation = presentation;
  }

  private tuneGroupItems(
    entry: QuadTreeEntry<T>,
    presentation: Presentation,
    rescale: boolean,
    retext: boolean
  ): void {
    for (const element of entry.oversizeItems.children) {
      if (rescale) element.applyScale(presentation.scale);
      if (retext) element.setTextHidden?.(presentation.textHidden);
    }
    if (entry.leafItems) {
      for (const element of entry.leafItems.children) {
        if (rescale) element.applyScale(presentation.scale);
        if (retext) element.setTextHidden?.(presentation.textHidden);
      }
    }
    const branches = entry.branches;
    // Children the same size are all group roots or none: nested groups
    // carry stamps of their own.
    if (!branches || branches.nw.isGroupRoot) return;
    this.tuneGroupItems(branches.nw, presentation, rescale, retext);
    this.tuneGroupItems(branches.ne, presentation, rescale, retext);
    this.tuneGroupItems(branches.sw, presentation, rescale, retext);
    this.tuneGroupItems(branches.se, presentation, rescale, retext);
  }

  /**
   * Tunes an arriving element to the group it files into, whatever state its
   * previous host left it in — or to the board's when `group` is null (it is
   * leaving the tree) or its stamp is unknown.
   */
  private presentElement(element: T, group: QuadTreeEntry<T> | null): void {
    const presentation = group?.presentation ?? this._board;
    element.applyScale(presentation.scale);
    element.setTextHidden?.(presentation.textHidden);
  }

  /** The group root at or above `entry`, whose stamp covers its elements. */
  private groupOf(entry: QuadTreeEntry<T>): QuadTreeEntry<T> {
    let group = entry;
    while (!group.isGroupRoot) group = group.parent as QuadTreeEntry<T>;
    return group;
  }

  /** Doubles the tree's size toward the given center. */
  private expand(centerX: number, centerY: number): void {
    const oldRegion = this._tree.region;
    const expandLeft = centerX < oldRegion.x;
    const expandUp = centerY < oldRegion.y;
    const newX = expandLeft ? oldRegion.x - oldRegion.width : oldRegion.x;
    const newY = expandUp ? oldRegion.y - oldRegion.height : oldRegion.y;

    // The new entries start empty, so any stamp is true of them; the
    // board's is the one an arriving element will usually already carry.
    const newRoot = super.addChild(
      new QuadTreeEntry<T>(newX, newY, oldRegion.width * 2, this._board)
    );

    const nwEntry = new QuadTreeEntry<T>(
      newX,
      newY,
      oldRegion.width,
      this._board
    );
    const neEntry = new QuadTreeEntry<T>(
      newX + oldRegion.width,
      newY,
      oldRegion.width,
      this._board
    );
    const swEntry = new QuadTreeEntry<T>(
      newX,
      newY + oldRegion.height,
      oldRegion.width,
      this._board
    );
    const seEntry = new QuadTreeEntry<T>(
      newX + oldRegion.width,
      newY + oldRegion.height,
      oldRegion.width,
      this._board
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
    // Children that root groups of their own take the leaf's elements as
    // they are, so its stamp too; smaller ones stay under its stamp.
    const stamp = entry.presentation;

    entry.branches = {
      nw: entry.addChild(new QuadTreeEntry<T>(b.x, b.y, half, stamp)),
      ne: entry.addChild(new QuadTreeEntry<T>(b.x + half, b.y, half, stamp)),
      sw: entry.addChild(new QuadTreeEntry<T>(b.x, b.y + half, half, stamp)),
      se: entry.addChild(
        new QuadTreeEntry<T>(b.x + half, b.y + half, half, stamp)
      )
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
      // Children below a group root were already under this entry's group
      // stamp, so only absorbing groups of their own can change it.
      if (entry.branches.nw.isGroupRoot) {
        entry.presentation = this.mergedPresentation(entry);
      }

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
  /**
   * The stamp a merge leaves on a group root absorbing child groups: the one
   * every element it gathers shares, or null when they disagree — absorbed
   * groups may have been culled, so lagging behind the live zoom or still in
   * a snapshot's state, and null makes the next visit re-tune the merged set.
   * An empty holder's stamp is true of anything, so it has no say.
   */
  private mergedPresentation(entry: QuadTreeEntry<T>): Presentation | null {
    let merged: Presentation | null = null;
    const holders = [entry, ...Object.values(entry.branches!)];
    for (const holder of holders) {
      const count =
        holder.oversizeItems.children.length +
        (holder === entry ? 0 : (holder.leafItems?.children.length ?? 0));
      if (count === 0) continue;
      const stamp = holder.presentation;
      if (stamp === null) return null;
      if (merged === null) merged = stamp;
      else if (!samePresentation(merged, stamp)) return null;
    }
    return merged ?? entry.presentation;
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
