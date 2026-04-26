import { Container, ContainerChild, Rectangle } from 'pixi.js';

type Quadrant = 'nw' | 'ne' | 'sw' | 'se';

class QuadTreeEntry<T extends ContainerChild> extends Container {
	branchItems: Container<T> = this.addChild(new Container<T>());
	leafItems: Container<T> | null = this.addChild(new Container<T>());
	branches: Record<Quadrant, QuadTreeEntry<T>> | null = null;

	// x, y, size encode the spatial region via boundsArea.
	// The container itself always sits at position (0, 0) so that elements
	// reparented between entries never shift their world coordinates.
	constructor(x: number, y: number, size: number) {
		super({ boundsArea: new Rectangle(x, y, size, size) });
	}

	get size() {
		return this.boundsArea.width;
	}
}

export class QuadTreeContainer<T extends ContainerChild> extends Container {
	private static readonly MAX_LEAF_ELEMENTS = 4;
	private static readonly MIN_BRANCH_ELEMENTS = 2;
	private static readonly INITIAL_SIZE = 1024;
	private static readonly MIN_LEAF_SIZE = 2;

	private tree = super.addChild(
		new QuadTreeEntry<T>(0, 0, QuadTreeContainer.INITIAL_SIZE)
	);
	private items = new Map<T, QuadTreeEntry<T>>();

	/**
	 * Inserts an element into the quad tree.
	 * @param element element to insert
	 */
	public insert(element: T): void {
		if (this.items.has(element)) {
			this.remove(element);
		}

		const elBounds = element.getBounds().rectangle;

		while (!this.tree.getBounds().rectangle.containsRect(elBounds)) {
			this.expand();
		}

		for (let entry = this.tree; ; ) {
			const quadrant = this.getContainingQuadrant(
				entry.getBounds().rectangle,
				elBounds
			);
			if (!quadrant) {
				entry.branchItems.addChild(element);
				this.items.set(element, entry);
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
				this.items.set(element, entry);
				return;
			} else {
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
		const entry = this.items.get(element);
		if (!entry) return false;

		if (entry.branchItems.children.includes(element)) {
			entry.branchItems.removeChild(element);
		} else if (entry.leafItems?.children.includes(element)) {
			entry.leafItems.removeChild(element);
		} else {
			throw new Error(
				'PANIC: Invalid Quad Tree state: element was found in hashmap but not in tree'
			);
		}

		if (entry.parent !== this)
			this.minifyBranch(entry.parent as QuadTreeEntry<T>);
		this.items.delete(element);
		return true;
	}

	/**
	 * Returns an iterator over all elements that are contained in the given range.
	 * @param range rectangle defining the range to query
	 */
	public *queryRange(range: Rectangle): Generator<T> {
		yield* this.queryRangeOfEntry(this.tree, range);
	}

	private *queryRangeOfEntry(
		entry: QuadTreeEntry<T>,
		range: Rectangle
	): Generator<T> {
		for (const element of entry.branchItems.children) {
			if (range.containsRect(element.getBounds().rectangle)) {
				yield element;
			}
		}

		if (entry.branches) {
			for (const branch of Object.values(entry.branches)) {
				if (range.intersects(branch.getBounds().rectangle)) {
					yield* this.queryRangeOfEntry(branch, range);
				}
			}
		} else {
			for (const element of entry.leafItems!.children) {
				if (range.containsRect(element.getBounds().rectangle)) {
					yield element;
				}
			}
		}
	}

	/**
	 * Expands the quad tree by doubling its size.
	 * @private
	 */
	private expand(): void {
		const oldBounds = this.tree.getBounds().rectangle;
		const newRoot = this.addChild(
			new QuadTreeEntry<T>(oldBounds.x, oldBounds.y, oldBounds.width * 2)
		);

		newRoot.branches = {
			nw: newRoot.addChild(this.tree),
			ne: newRoot.addChild(
				new QuadTreeEntry<T>(
					oldBounds.x + oldBounds.width,
					oldBounds.y,
					oldBounds.width
				)
			),
			sw: newRoot.addChild(
				new QuadTreeEntry<T>(
					oldBounds.x,
					oldBounds.y + oldBounds.height,
					oldBounds.width
				)
			),
			se: newRoot.addChild(
				new QuadTreeEntry<T>(
					oldBounds.x + oldBounds.width,
					oldBounds.y + oldBounds.height,
					oldBounds.width
				)
			)
		};

		this.minifyBranch(newRoot);
		this.tree = newRoot;
	}

	/**
	 * Converts the leaf into a branch and distributes the elements of the leaf into the children of the branch.
	 * @private
	 */
	private splitLeaf(entry: QuadTreeEntry<T>): QuadTreeEntry<T> {
		if (!entry.leafItems) {
			throw new Error('PANIC: Trying to split a non-leaf');
		}

		const b = entry.getBounds().rectangle;
		const half = b.width / 2;

		entry.branches = {
			nw: entry.addChild(new QuadTreeEntry<T>(b.x, b.y, half)),
			ne: entry.addChild(new QuadTreeEntry<T>(b.x + half, b.y, half)),
			sw: entry.addChild(new QuadTreeEntry<T>(b.x, b.y + half, half)),
			se: entry.addChild(new QuadTreeEntry<T>(b.x + half, b.y + half, half))
		};

		for (const element of [...entry.leafItems.children]) {
			const quadrant = this.getContainingQuadrant(
				entry.getBounds().rectangle,
				element.getBounds().rectangle
			);
			if (!quadrant) {
				throw new Error(
					'PANIC: Invalid Quad Tree state: leaf element is not contained in any quadrant'
				);
			}

			const quadrantInner = this.getContainingQuadrant(
				entry.branches[quadrant].getBounds().rectangle,
				element.getBounds().rectangle
			);

			if (quadrantInner) {
				entry.branches[quadrant].leafItems!.addChild(element);
			} else {
				entry.branches[quadrant].branchItems.addChild(element);
			}

			this.items.set(element, entry.branches[quadrant]);
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
					this.items.set(element, entry);
					entry.leafItems.addChild(element);
				}
				if (child.leafItems) {
					for (const element of [...child.leafItems.children]) {
						this.items.set(element, entry);
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
