interface AbstractEntry<T> {
	parent: Branch<T> | null;
	x: number;
	y: number;
	size: number;
	branchElements: T[];
	leafElements: T[] | null;
	children: Record<'nw' | 'ne' | 'sw' | 'se', ChildEntry<T>> | null;
}

interface Branch<T> extends AbstractEntry<T> {
	leafElements: null;
	children: NonNullable<AbstractEntry<T>['children']>;
}

interface Leaf<T> extends AbstractEntry<T> {
	leafElements: NonNullable<AbstractEntry<T>['leafElements']>;
	children: null;
}

type Entry<T> = Branch<T> | Leaf<T>;
type Root<T> = Entry<T> & { parent: null };
type ChildEntry<T> = Entry<T> & { parent: NonNullable<AbstractEntry<T>['parent']> };

export interface TreeItem {
	x: number;
	y: number;
	x2: number;
	y2: number;
}

export class QuadTree<T extends TreeItem> {

	private static readonly MAX_LEAF_ELEMENTS = 4;
	private static readonly MIN_BRANCH_ELEMENTS = 2;
	private static readonly INITIAL_SIZE = 1024;
	private static readonly MIN_SIZE = 16;

	private tree: Root<T> = {
		x: 0,
		y: 0,
		size: QuadTree.INITIAL_SIZE,
		branchElements: [],
		leafElements: [],
		children: null,
		parent: null
	};

	/**
	 * Inserts an element into the quad tree.
	 * @param element element to insert
	 */
	public insert(element: T): void {
		while (element.x2 >= this.tree.size || element.y2 >= this.tree.size) {
			this.expand();
		}

		for (let entry: Entry<T> = this.tree;;) {
			if (!this.elementIsContainedInChild(entry, element)) {
				entry.branchElements.push(element);
				return;
			}

			if (entry.children !== null) {
				// This is a branch, so we have to go deeper.
				entry = this.getChildForPoint(entry as Branch<T>, element.x, element.y);
			} else {
				// This is a leaf, so we have to check if we can insert the element here or if we have to split the leaf.
				if (entry.leafElements.length >= QuadTree.MAX_LEAF_ELEMENTS && entry.size > QuadTree.MIN_SIZE) {
					entry = this.getChildForPoint(this.splitLeaf(entry as Leaf<T>), element.x, element.y);
					continue;
				}

				entry.leafElements.push(element);
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
		for (let entry: Entry<T> = this.tree;;) {
			if (!this.elementIsContainedInChild(entry, element)) {
				const index = entry.branchElements.indexOf(element);

				if (index === -1) {
					return false;
				}

				entry.branchElements.splice(index, 1);
				return true;
			}

			if (entry.children !== null) {
				// This is a branch, so we have to go deeper.
				entry = this.getChildForPoint(entry as Branch<T>, element.x, element.y);
			} else {
				// This is a leaf, so we have to check if we can remove the element here or if it is not found.
				const index = entry.leafElements.indexOf(element);

				if (index === -1) {
					return false;
				}

				entry.leafElements.splice(index, 1);
				if (entry.parent !== null)
					this.minifyBranch(entry.parent);
				return true;
			}
		}
	}

	/**
	 * Returns an iterator over all elements that are contained in the given range.
	 * @param x x coordinate of the top left corner of the range
	 * @param y y coordinate of the top left corner of the range
	 * @param x2 x coordinate of the bottom right corner of the range
	 * @param y2 y coordinate of the bottom right corner of the range
	 */
	public *queryRange(x: number, y: number, x2: number, y2: number): Generator<T> {
		yield *this.queryRangeOfEntry(this.tree, x, y, x2, y2);
	}

	private *queryRangeOfEntry(entry: Entry<T>, x: number, y: number, x2: number, y2: number): Generator<T> {
		for (const element of entry.branchElements) {
			if (element.x2 >= x && element.x <= x2 && element.y2 >= y && element.y <= y2) {
				yield element;
			}
		}

		if (entry.children !== null) {
			if (x < entry.x + entry.size / 2) {
				if (y < entry.y + entry.size / 2) {
					yield *this.queryRangeOfEntry(entry.children.nw, x, y, x2, y2);
				}
				if (y2 >= entry.y + entry.size / 2) {
					yield *this.queryRangeOfEntry(entry.children.sw, x, y, x2, y2);
				}
			}
			if (x2 >= entry.x + entry.size / 2) {
				if (y < entry.y + entry.size / 2) {
					yield *this.queryRangeOfEntry(entry.children.ne, x, y, x2, y2);
				}
				if (y2 >= entry.y + entry.size / 2) {
					yield *this.queryRangeOfEntry(entry.children.se, x, y, x2, y2);
				}
			}
		} else {
			for (const element of entry.leafElements) {
				if (element.x2 >= x && element.x <= x2 && element.y2 >= y && element.y <= y2) {
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
		const newRoot: Omit<Branch<T>, 'children'> = {
			x: 0,
			y: 0,
			size: this.tree.size * 2,
			branchElements: [],
			leafElements: null,
			parent: null
		};

		(newRoot as Branch<T>).children = {
			nw: {
				...this.tree,
				parent: newRoot as Branch<T>
			},
			ne: {
				x: this.tree.size,
				y: 0,
				size: this.tree.size,
				branchElements: [],
				leafElements: [],
				parent: newRoot as Branch<T>,
				children: null
			},
			sw: {
				x: 0,
				y: this.tree.size,
				size: this.tree.size,
				branchElements: [],
				leafElements: [],
				parent: newRoot as Branch<T>,
				children: null
			},
			se: {
				x: this.tree.size,
				y: this.tree.size,
				size: this.tree.size,
				branchElements: [],
				leafElements: [],
				parent: newRoot as Branch<T>,
				children: null
			}
		};

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
				branchElements: [],
				leafElements: [],
				parent: entry as Entry<T> as Branch<T>,
				children: null
			},
			ne: {
				x: entry.x + entry.size / 2,
				y: entry.y,
				size: entry.size / 2,
				branchElements: [],
				leafElements: [],
				parent: entry as Entry<T> as Branch<T>,
				children: null
			},
			sw: {
				x: entry.x,
				y: entry.y + entry.size / 2,
				size: entry.size / 2,
				branchElements: [],
				leafElements: [],
				parent: entry as Entry<T> as Branch<T>,
				children: null
			},
			se: {
				x: entry.x + entry.size / 2,
				y: entry.y + entry.size / 2,
				size: entry.size / 2,
				branchElements: [],
				leafElements: [],
				parent: entry as Entry<T> as Branch<T>,
				children: null
			}
		};

		for (const element of entry.leafElements) {
			const child = this.getChildForPoint(entry as Entry<T> as Branch<T>, element.x, element.y);

			if (this.elementIsContainedInChild(child, element)) {
				child.leafElements!.push(element);
			} else {
				child.branchElements.push(element);
			}
		}

		(entry as Entry<T>).leafElements = null;

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
				childrenCount += child.leafElements.length;
			}
			childrenCount += child.branchElements.length;
		}

		if (childrenCount < QuadTree.MIN_BRANCH_ELEMENTS) {
			const elements: T[] = [];
			for (const child of Object.values(entry.children)) {
				for (const element of child.branchElements) {
					elements.push(element);
				}
				for (const element of child.leafElements!) {
					elements.push(element);
				}
			}
			(entry as Entry<T> as Leaf<T>).leafElements = elements;
			(entry as Entry<T> as Leaf<T>).children = null;
		}

		return childrenCount;
	}

	/**
	 * Returns true if the element would be contained in one of the children of the entry.
	 * @private
	 */
	private elementIsContainedInChild(entry: Entry<T>, element: TreeItem): boolean {
		return !((element.x < entry.x + entry.size / 2 && element.x2 >= entry.x + entry.size / 2)
			|| (element.y < entry.y + entry.size / 2 && element.y2 >= entry.y + entry.size / 2));
	}

	/**
	 * Returns the child of the entry that contains the point.
	 * @private
	 */
	private getChildForPoint(entry: Branch<T>, x: number, y: number): ChildEntry<T> {
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
