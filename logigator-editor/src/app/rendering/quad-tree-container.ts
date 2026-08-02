import { Container, ContainerChild, Graphics, Rectangle } from 'pixi.js';
import { GridElement } from './grid-element';
import { getStaticDI } from '../utils/get-di';
import { LoggingService } from '../logging/logging.service';

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

export class QuadTreeContainer<T extends GridElement> extends Container {
  private static readonly MAX_LEAF_ELEMENTS = 4;
  private static readonly MIN_BRANCH_ELEMENTS = 2;
  private static readonly INITIAL_SIZE = 64;
  private static readonly MIN_LEAF_SIZE = 1;

  private _tree = super.addChild(
    new QuadTreeEntry<T>(0, 0, QuadTreeContainer.INITIAL_SIZE)
  );
  private _items = new Map<T, QuadTreeEntry<T>>();

  // Debug overlay rendering the live quadrant subdivision, gated by
  // SHOW_QUAD_TREES. Null (and every debug path a no-op) when the flag is off,
  // so production builds carry no overhead.
  private _debugOverlay: Graphics | null = null;
  // Mutations only flag the overlay dirty; the actual (full-tree) redraw is
  // coalesced to at most once per frame in onRender. A bulk load fires
  // thousands of insert()s — redrawing on each would be O(elements × tree) and
  // hang the page.
  private _debugDirty = false;

  /**
   * @param debugColor base hue for the debug quadrant overlay. Pass distinct
   * colors when multiple trees share the same space so their grids stay
   * distinguishable (e.g. wires vs components).
   */
  constructor(private readonly _debugColor = 0xff00ff) {
    super();

    if (SHOW_QUAD_TREES) {
      // zIndex keeps the overlay above the entries (expand() appends a new root
      // on top of it).
      this.sortableChildren = true;
      this._debugOverlay = super.addChild(new Graphics());
      this._debugOverlay.zIndex = 1;
      this.onRender = () => {
        if (!this._debugDirty) return;
        this._debugDirty = false;
        this.redrawDebug();
      };
    }
  }

  /**
   * Inserts an element into the quad tree.
   * @param element element to insert
   */
  public insert(element: T): void {
    this.insertElement(element);
    this._debugDirty = true;
  }

  private insertElement(element: T): void {
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
          `insertElement reached an entry (size ${entry.size}) with neither branches nor leafItems; element bounds ${JSON.stringify(elBounds)}`,
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
    const removed = this.removeElement(element);
    if (removed) this._debugDirty = true;
    return removed;
  }

  private removeElement(element: T): boolean {
    const entry = this._items.get(element);
    if (!entry) return false;

    if (entry.branchItems.children.includes(element)) {
      entry.branchItems.removeChild(element);
    } else if (entry.leafItems?.children.includes(element)) {
      entry.leafItems.removeChild(element);
    } else {
      getStaticDI(LoggingService).error(
        `removeElement found the element in _items but in neither branchItems nor leafItems of its entry (size ${entry.size})`,
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
   * Returns an iterator over all elements whose bounds intersect the given range.
   * Elements that only partially overlap the range are included.
   * @param range rectangle defining the range to query
   */
  public *queryRange(range: Rectangle): Generator<T> {
    yield* this.queryRangeOfEntry(this._tree, range);
  }

  private *queryRangeOfEntry(
    entry: QuadTreeEntry<T>,
    range: Rectangle
  ): Generator<T> {
    for (const element of entry.branchItems.children) {
      if (range.intersects(element.gridBounds)) {
        yield element;
      }
    }

    if (entry.branches) {
      for (const branch of Object.values(entry.branches)) {
        if (range.intersects(branch.boundsArea)) {
          yield* this.queryRangeOfEntry(branch, range);
        }
      }
    } else {
      for (const element of entry.leafItems!.children) {
        if (range.intersects(element.gridBounds)) {
          yield element;
        }
      }
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
   * Redraws the debug overlay from scratch, mirroring the current tree
   * structure. Driven by the dirty flag from onRender — coalesces a burst of
   * mutations into a single redraw per frame.
   */
  private redrawDebug(): void {
    if (!this._debugOverlay) return;
    this._debugOverlay.clear();
    this.drawDebugEntry(this._tree, 0);
  }

  private drawDebugEntry(entry: QuadTreeEntry<T>, depth: number): void {
    const overlay = this._debugOverlay!;
    const b = entry.boundsArea;
    const isLeaf = !entry.branches;

    overlay.rect(b.x, b.y, b.width, b.height);
    if (isLeaf) {
      overlay.fill({
        color: this._debugColor,
        alpha: Math.min(0.015 + depth * 0.015, 0.1)
      });
    }
    overlay.stroke({
      color: this._debugColor,
      alpha: 0.5,
      width: 1,
      pixelLine: true
    });

    if (entry.branches) {
      for (const child of Object.values(entry.branches)) {
        this.drawDebugEntry(child, depth + 1);
      }
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
