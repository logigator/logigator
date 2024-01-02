import { QuadTree, TreeItem } from './quad-tree';
import arrayWithExactContents = jasmine.arrayWithExactContents;

describe('QuadTree', () => {
	it('inserted item can be retrieved', () => {
		const quadTree = new QuadTree();

		const items: TreeItem[] = [{ x: 0, y: 0, x2: 10, y2: 10 }];
		insertIntoTree(quadTree, items);

		expect(
			Array.from(
				quadTree.queryRange(
					0,
					0,
					Number.MAX_SAFE_INTEGER,
					Number.MAX_SAFE_INTEGER
				)
			)
		).toEqual([items[0]]);
	});

	it('queryRange does not return items outside of range', () => {
		const quadTree = new QuadTree();

		const items: TreeItem[] = [
			{ x: 10, y: 10, x2: 20, y2: 20 },
			{ x: 21, y: 21, x2: 30, y2: 30 },
			{ x: 20, y: 20, x2: 20, y2: 20 },
			{ x: 20, y: 20, x2: 22, y2: 22 },
			{ x: 20, y: 21, x2: 20, y2: 21 },
			{ x: 21, y: 20, x2: 21, y2: 20 },
			{ x: 0, y: 0, x2: 9, y2: 9 },
			{ x: 0, y: 0, x2: 10, y2: 10 },
			{ x: 9, y: 9, x2: 9, y2: 9 },
			{ x: 10, y: 10, x2: 10, y2: 10 }
		];
		insertIntoTree(quadTree, items);

		expect(Array.from(quadTree.queryRange(10, 10, 20, 20))).toEqual(
			arrayWithExactContents([items[0], items[2], items[3], items[7], items[9]])
		);
	});

	it('inserted item outside of initial size is handled correctly', () => {
		const quadTree = new QuadTree();

		const items: TreeItem[] = [
			{ x: 10000, y: 10000, x2: 20000, y2: 20000 },
			{ x: 40000, y: 40000, x2: 41000, y2: 41000 }
		];
		insertIntoTree(quadTree, items);

		expect(Array.from(quadTree.queryRange(0, 0, 40000, 40000))).toEqual(
			arrayWithExactContents(items)
		);
	});

	it('inserting 1000 items works correctly', () => {
		const quadTree = new QuadTree();

		const items = insertRandomItems(quadTree, 1000);

		expect(Array.from(quadTree.queryRange(0, 0, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER))).toEqual(
			arrayWithExactContents(items)
		);
		expect(Array.from(quadTree.queryRange(0, 0, 5000, 5000))).toEqual(
			arrayWithExactContents(items.filter((x) => x.x <= 5000 && x.y <= 5000))
		);
	});

	it('removing items works correctly', () => {
		const quadTree = new QuadTree();

		const items = insertRandomItems(quadTree, 10);

		quadTree.remove(items[1]);
		quadTree.remove(items[3]);
		quadTree.remove(items[5]);
		quadTree.remove(items[7]);
		quadTree.remove(items[9]);

		expect(
			Array.from(
				quadTree.queryRange(
					0,
					0,
					Number.MAX_SAFE_INTEGER,
					Number.MAX_SAFE_INTEGER
				)
			)
		).toEqual(
			arrayWithExactContents([items[0], items[2], items[4], items[6], items[8]])
		);
	});
});

function insertRandomItems(
	tree: QuadTree<TreeItem>,
	count: number
): TreeItem[] {
	const items: TreeItem[] = [];

	for (let i = 0; i < count; i++) {
		const x = Math.random() * 10000;
		const y = Math.random() * 10000;

		items.push({
			x,
			y,
			x2: x + Math.random() * 5000,
			y2: y + Math.random() * 5000
		});
	}
	insertIntoTree(tree, items);

	return items;
}

function insertIntoTree<T extends TreeItem>(
	tree: QuadTree<T>,
	items: T[]
): QuadTree<T> {
	for (const item of items) {
		tree.insert(item);
	}

	return tree;
}
