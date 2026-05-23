import { Point, Rectangle } from 'pixi.js';
import { Wire } from '../wires/wire';
import { WireDirection } from '../wires/wire-direction.enum';

export class WireIntegrator {
	integrate(
		newWires: Wire[],
		queryWiresInRange: (rect: Rectangle) => Generator<Wire>,
		scale: number
	): { toAdd: Wire[]; toRemove: Wire[] } {
		const toAdd: Wire[] = [];
		const toRemove = new Set<Wire>();

		for (const n of newWires) {
			const mergeGroup: Wire[] = [n];
			let segStart = this._axisPos(n);
			let segEnd = segStart + n.length;
			let changed = true;

			while (changed) {
				changed = false;
				const queryRect = this._collinearQueryRect(n.direction, n.position, segStart, segEnd);

				for (const c of queryWiresInRange(queryRect)) {
					if (c === n || toRemove.has(c)) continue;
					if (c.direction !== n.direction) continue;
					if (!this._isSameAxis(n, c)) continue;

					const cStart = this._axisPos(c);
					const cEnd = cStart + c.length;

					const overlapStart = Math.max(segStart, cStart);
					const overlapEnd = Math.min(segEnd, cEnd);

					if (overlapStart < overlapEnd) {
						toRemove.add(c);
						mergeGroup.push(c);
						segStart = Math.min(segStart, cStart);
						segEnd = Math.max(segEnd, cEnd);
						changed = true;
					} else if (overlapStart === overlapEnd) {
						const p =
							n.direction === WireDirection.HORIZONTAL
								? new Point(overlapStart, n.position.y)
								: new Point(n.position.x, overlapStart);
						if (!this._hasTJunctionAt(p, new Set([...toRemove, ...mergeGroup, c]), queryWiresInRange)) {
							toRemove.add(c);
							mergeGroup.push(c);
							segStart = Math.min(segStart, cStart);
							segEnd = Math.max(segEnd, cEnd);
							changed = true;
						}
					}
				}
			}

			if (mergeGroup.length > 1) {
				toAdd.push(this._createMergedWire(n.direction, n.position, segStart, segEnd, scale));
				toRemove.add(n);
			} else {
				toAdd.push(n);
			}
		}

		// Second pass: merge toAdd wires with each other.
		// Needed when two new wires are adjacent to opposite ends of the same existing
		// wire — the first new wire consumes the existing wire, but the second can't see
		// the merged result via the quad tree.
		let secondPassChanged = true;
		while (secondPassChanged) {
			secondPassChanged = false;
			outer: for (let i = 0; i < toAdd.length; i++) {
				for (let j = i + 1; j < toAdd.length; j++) {
					const wi = toAdd[i];
					const wj = toAdd[j];
					if (wi.direction !== wj.direction || !this._isSameAxis(wi, wj)) continue;

					const iStart = this._axisPos(wi);
					const iEnd = iStart + wi.length;
					const jStart = this._axisPos(wj);
					const jEnd = jStart + wj.length;

					const overlapStart = Math.max(iStart, jStart);
					const overlapEnd = Math.min(iEnd, jEnd);

					if (overlapStart > overlapEnd) continue;

					if (overlapStart === overlapEnd) {
						const p =
							wi.direction === WireDirection.HORIZONTAL
								? new Point(overlapStart, wi.position.y)
								: new Point(wi.position.x, overlapStart);
						if (this._hasTJunctionAt(p, new Set([...toRemove, wi, wj]), queryWiresInRange)) continue;
					}

					const mergedStart = Math.min(iStart, jStart);
					const mergedEnd = Math.max(iEnd, jEnd);
					const merged = this._createMergedWire(wi.direction, wi.position, mergedStart, mergedEnd, scale);

					if (newWires.includes(wi)) toRemove.add(wi);
					if (newWires.includes(wj)) toRemove.add(wj);

					toAdd.splice(j, 1);
					toAdd.splice(i, 1);
					toAdd.push(merged);
					secondPassChanged = true;
					break outer;
				}
			}
		}

		return { toAdd, toRemove: [...toRemove] };
	}

	private _axisPos(w: Wire): number {
		return w.direction === WireDirection.HORIZONTAL ? w.position.x : w.position.y;
	}

	private _createMergedWire(
		direction: WireDirection,
		refPos: Point,
		segStart: number,
		segEnd: number,
		scale: number
	): Wire {
		const merged = new Wire(direction, segEnd - segStart);
		if (direction === WireDirection.HORIZONTAL) {
			merged.position.set(segStart, refPos.y);
		} else {
			merged.position.set(refPos.x, segStart);
		}
		merged.applyScale(scale);
		return merged;
	}

	private _collinearQueryRect(
		direction: WireDirection,
		pos: Point,
		segStart: number,
		segEnd: number
	): Rectangle {
		if (direction === WireDirection.HORIZONTAL) {
			return new Rectangle(segStart - 1, Math.floor(pos.y), segEnd - segStart + 2, 1);
		}
		return new Rectangle(Math.floor(pos.x), segStart - 1, 1, segEnd - segStart + 2);
	}

	private _isSameAxis(a: Wire, b: Wire): boolean {
		if (a.direction === WireDirection.HORIZONTAL) {
			return a.position.y === b.position.y;
		}
		return a.position.x === b.position.x;
	}

	private _hasTJunctionAt(
		p: Point,
		exclude: Set<Wire>,
		queryWiresInRange: (rect: Rectangle) => Generator<Wire>
	): boolean {
		const queryRect = new Rectangle(p.x - 1, p.y - 1, 2, 2);
		for (const w of queryWiresInRange(queryRect)) {
			if (exclude.has(w)) continue;
			if (w.contains(p)) return true;
		}
		return false;
	}
}
