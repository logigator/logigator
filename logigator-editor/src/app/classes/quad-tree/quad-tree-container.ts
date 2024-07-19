import { Container, DisplayObject } from 'pixi.js';

interface Item<T> {
	item: T;
	x: number;
	y: number;
	x2: number;
	y2: number;
}

interface AbstractEntry<T> {
	parent: Branch<T> | null;
	x: number;
	y: number;
	size: number;
	branchItems: Item<T>[];
	leafItems: Item<T>[] | null;
	children: Record<'nw' | 'ne' | 'sw' | 'se', ChildEntry<T>> | null;
}

interface Branch<T> extends AbstractEntry<T> {
	leafItems: null;
	children: NonNullable<AbstractEntry<T>['children']>;
}

interface Leaf<T> extends AbstractEntry<T> {
	leafItems: NonNullable<AbstractEntry<T>['leafItems']>;
	children: null;
}

type Entry<T> = Branch<T> | Leaf<T>;
type Root<T> = Entry<T> & { parent: null };
type ChildEntry<T> = Entry<T> & {
	parent: NonNullable<AbstractEntry<T>['parent']>;
};

export class QuadTreeContainer<T extends DisplayObject> extends Container {
	private static readonly MAX_LEAF_ELEMENTS = 4;
	private static readonly MIN_BRANCH_ELEMENTS = 2;
	private static readonly INITIAL_SIZE = 1024;
	private static readonly MIN_LEAF_SIZE = 2;

	private tree: Root<T> = {
		x: 0,
		y: 0,
		size: QuadTreeContainer.INITIAL_SIZE,
		branchItems: [],
		leafItems: [],
		children: null,
		parent: null
	};
	private items: Map<T, Entry<T>> = new Map();

	/**
	 * Inserts an element into the quad tree.
	 * @param element element to insert
	 * @param x x coordinate of the top left corner of the element
	 * @param y y coordinate of the top left corner of the element
	 * @param x2 x coordinate of the bottom right corner of the element
	 * @param y2 y coordinate of the bottom right corner of the element
	 */
	public insert(
		element: T,
		x: number,
		y: number,
		x2: number,
		y2: number
	): void {
		if (this.items.has(element)) {
			this.remove(element);
		}

		while (x2 >= this.tree.size || y2 >= this.tree.size) {
			this.expand();
		}

		for (let entry: Entry<T> = this.tree; ; ) {
			if (!this.itemIsContainedInChild(entry, x, y, x2, y2)) {
				entry.branchItems.push({
					item: element,
					x,
					y,
					x2,
					y2
				});
				this.items.set(element, entry);
				return;
			}

			if (entry.children !== null) {
				// This is a branch, so we have to go deeper.
				entry = this.getChildForPoint(entry as Branch<T>, x, y);
			} else {
				// This is a leaf, so we have to check if we can insert the element here or if we have to split the leaf.
				if (
					entry.leafItems.length >= QuadTreeContainer.MAX_LEAF_ELEMENTS &&
					entry.size >= QuadTreeContainer.MIN_LEAF_SIZE * 2
				) {
					entry = this.getChildForPoint(this.splitLeaf(entry as Leaf<T>), x, y);
					continue;
				}

				entry.leafItems.push({
					item: element,
					x,
					y,
					x2,
					y2
				});
				this.items.set(element, entry);
				return;
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
		if (entry === undefined) return false;

		let index = entry.branchItems.findIndex((x) => x.item === element);
		if (index !== -1) {
			entry.branchItems.splice(index, 1);
			if (entry.parent !== null) this.minifyBranch(entry.parent);
			return true;
		}

		if (entry.leafItems) {
			index = entry.leafItems.findIndex((x) => x.item === element);
			if (index !== -1) {
				entry.leafItems.splice(index, 1);
				if (entry.parent !== null) this.minifyBranch(entry.parent);
				return true;
			}
		}

		throw new Error(
			'Internal error: element was found in hashmap but not in tree'
		);
	}

	/**
	 * Returns an iterator over all elements that are contained in the given range.
	 * @param x x coordinate of the top left corner of the range
	 * @param y y coordinate of the top left corner of the range
	 * @param x2 x coordinate of the bottom right corner of the range
	 * @param y2 y coordinate of the bottom right corner of the range
	 */
	public *queryRange(
		x: number,
		y: number,
		x2: number,
		y2: number
	): Generator<T> {
		yield* this.queryRangeOfEntry(this.tree, x, y, x2, y2);
	}

	private *queryRangeOfEntry(
		entry: Entry<T>,
		x: number,
		y: number,
		x2: number,
		y2: number
	): Generator<T> {
		for (const element of entry.branchItems) {
			if (
				element.x2 >= x &&
				element.x <= x2 &&
				element.y2 >= y &&
				element.y <= y2
			) {
				yield element.item;
			}
		}

		if (entry.children !== null) {
			if (x < entry.x + entry.size / 2) {
				if (y < entry.y + entry.size / 2) {
					yield* this.queryRangeOfEntry(entry.children.nw, x, y, x2, y2);
				}
				if (y2 >= entry.y + entry.size / 2) {
					yield* this.queryRangeOfEntry(entry.children.sw, x, y, x2, y2);
				}
			}
			if (x2 >= entry.x + entry.size / 2) {
				if (y < entry.y + entry.size / 2) {
					yield* this.queryRangeOfEntry(entry.children.ne, x, y, x2, y2);
				}
				if (y2 >= entry.y + entry.size / 2) {
					yield* this.queryRangeOfEntry(entry.children.se, x, y, x2, y2);
				}
			}
		} else {
			for (const element of entry.leafItems) {
				if (
					element.x2 >= x &&
					element.x <= x2 &&
					element.y2 >= y &&
					element.y <= y2
				) {
					yield element.item;
				}
			}
		}
	}

	/**
	 * Expands the quad tree by doubling its size.
	 * @private
	 */
	private expand(): void {
		const newRoot: Omit<Branch<T>, 'children'> = {
			x: 0,
			y: 0,
			size: this.tree.size * 2,
			branchItems: [],
			leafItems: null,
			parent: null
		};

		(newRoot as Branch<T>).children = {
			nw: this.tree as Entry<T> as ChildEntry<T>,
			ne: {
				x: this.tree.size,
				y: 0,
				size: this.tree.size,
				branchItems: [],
				leafItems: [],
				parent: newRoot as Branch<T>,
				children: null
			},
			sw: {
				x: 0,
				y: this.tree.size,
				size: this.tree.size,
				branchItems: [],
				leafItems: [],
				parent: newRoot as Branch<T>,
				children: null
			},
			se: {
				x: this.tree.size,
				y: this.tree.size,
				size: this.tree.size,
				branchItems: [],
				leafItems: [],
				parent: newRoot as Branch<T>,
				children: null
			}
		};

		(newRoot as Branch<T>).children.nw.parent = newRoot as Branch<T>;

		this.minifyBranch(newRoot as Branch<T>);
		this.tree = newRoot as Root<T>;
	}

	/**
	 * Converts the leaf into a branch and distributes the elements of the leaf into the children of the branch.
	 * @private
	 */
	private splitLeaf(entry: Leaf<T>): Branch<T> {
		(entry as Entry<T>).children = {
			nw: {
				x: entry.x,
				y: entry.y,
				size: entry.size / 2,
				branchItems: [],
				leafItems: [],
				parent: entry as Entry<T> as Branch<T>,
				children: null
			},
			ne: {
				x: entry.x + entry.size / 2,
				y: entry.y,
				size: entry.size / 2,
				branchItems: [],
				leafItems: [],
				parent: entry as Entry<T> as Branch<T>,
				children: null
			},
			sw: {
				x: entry.x,
				y: entry.y + entry.size / 2,
				size: entry.size / 2,
				branchItems: [],
				leafItems: [],
				parent: entry as Entry<T> as Branch<T>,
				children: null
			},
			se: {
				x: entry.x + entry.size / 2,
				y: entry.y + entry.size / 2,
				size: entry.size / 2,
				branchItems: [],
				leafItems: [],
				parent: entry as Entry<T> as Branch<T>,
				children: null
			}
		};

		for (const element of entry.leafItems) {
			const child = this.getChildForPoint(
				entry as Entry<T> as Branch<T>,
				element.x,
				element.y
			);

			this.items.set(element.item, child);

			if (
				this.itemIsContainedInChild(
					child,
					element.x,
					element.y,
					element.x2,
					element.y2
				)
			) {
				child.leafItems!.push(element);
			} else {
				child.branchItems.push(element);
			}
		}

		(entry as Entry<T>).leafItems = null;

		return entry as Entry<T> as Branch<T>;
	}

	/**
	 * Merges leafs together whenever the parent branch has less than MIN_BRANCH_ELEMENTS branch elements.
	 * @param entry
	 * @private
	 */
	private minifyBranch(entry: Branch<T>): number {
		let childrenCount = 0;
		for (const child of Object.values(entry.children)) {
			if (child.children !== null) {
				childrenCount += this.minifyBranch(child as Branch<T>);
			} else {
				childrenCount += child.leafItems.length;
			}
			childrenCount += child.branchItems.length;
		}

		if (childrenCount < QuadTreeContainer.MIN_BRANCH_ELEMENTS) {
			const elements: Item<T>[] = [];
			for (const child of Object.values(entry.children)) {
				for (const element of child.branchItems) {
					this.items.set(element.item, entry);
					elements.push(element);
				}
				for (const element of child.leafItems!) {
					this.items.set(element.item, entry);
					elements.push(element);
				}
			}
			(entry as Entry<T> as Leaf<T>).leafItems = elements;
			(entry as Entry<T> as Leaf<T>).children = null;
		}

		return childrenCount;
	}

	/**
	 * Returns true if the element would be contained in one of the children of the entry.
	 * @private
	 */
	private itemIsContainedInChild(
		entry: Entry<T>,
		x: number,
		y: number,
		x2: number,
		y2: number
	): boolean {
		return !(
			(x < entry.x + entry.size / 2 && x2 >= entry.x + entry.size / 2) ||
			(y < entry.y + entry.size / 2 && y2 >= entry.y + entry.size / 2)
		);
	}

	/**
	 * Returns the child of the entry that contains the point.
	 * @private
	 */
	private getChildForPoint(
		entry: Branch<T>,
		x: number,
		y: number
	): ChildEntry<T> {
		if (x < entry.x + entry.size / 2) {
			if (y < entry.y + entry.size / 2) {
				return entry.children.nw;
			} else {
				return entry.children.sw;
			}
		} else {
			if (y < entry.y + entry.size / 2) {
				return entry.children.ne;
			} else {
				return entry.children.se;
			}
		}
	}
}
