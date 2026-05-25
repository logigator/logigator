import { Point, Rectangle } from 'pixi.js';
import { Wire } from '../wires/wire';
import { WireDirection } from '../wires/wire-direction.enum';
import { WireSnapshot } from '../wires/wire-snapshot.model';
import type { Component } from '../components/component';

export interface MovedWireEntry {
	wire: Wire;
	oldSnapshot: WireSnapshot;
}

export interface MovedComponentPortsEntry {
	oldPorts: readonly Point[];
	newPorts: readonly Point[];
}

export interface IntegrationInput {
	// Live wire instances not yet in the project tree.
	addedWires?: readonly Wire[];
	// Live wire instances currently in the project tree, about to be removed.
	removedWires?: readonly Wire[];
	// Wires already moved to their new positions in the project tree; oldSnapshot
	// captures the pre-move geometry so candidate points at old positions are seeded.
	movedWires?: readonly MovedWireEntry[];
	// Ports of a component about to be added (not yet in the project).
	addedComponentPorts?: readonly Point[];
	// Ports of a component currently in the project, about to be removed.
	removedComponentPorts?: readonly Point[];
	// Components already at their new positions in the project; queries reflect
	// newPorts already, so the integrator only needs oldPorts to mark candidates.
	movedComponentPorts?: readonly MovedComponentPortsEntry[];
}

export interface IntegrationOutput {
	// Fresh Wire instances the caller should add to the project tree
	// (split or merge results, plus addedWires that survived integration).
	toAdd: Wire[];
	// Live Wire instances currently in the project tree the caller should remove
	// (absorbed by merges or split into pieces).
	toRemove: Wire[];
}

// Bounds the fixed-point loop. In practice integration converges in 1–2 passes;
// hitting the cap implies a bug, so we throw rather than silently doing the wrong thing.
const MAX_ITERATIONS = 8;

function pointKey(p: { x: number; y: number }): string {
	return `${p.x},${p.y}`;
}

export class WireIntegrator {
	integrate(
		input: IntegrationInput,
		queryWiresInRange: (rect: Rectangle) => Generator<Wire>,
		queryComponentsInRange: (rect: Rectangle) => Generator<Component>,
		scale: number
	): IntegrationOutput {
		const addedWires = input.addedWires ?? [];
		const removedWires = input.removedWires ?? [];
		const movedWires = input.movedWires ?? [];
		const addedComponentPorts = input.addedComponentPorts ?? [];
		const removedComponentPorts = input.removedComponentPorts ?? [];
		const movedComponentPorts = input.movedComponentPorts ?? [];

		const candidates = new Map<string, Point>();
		const addCandidate = (p: Point) => {
			const k = pointKey(p);
			if (!candidates.has(k)) candidates.set(k, p.clone());
		};

		// Wires the caller is treating as live but that are not yet in the project tree.
		// Starts with addedWires; grows as the integrator creates split/merge results.
		const freshLive = new Set<Wire>();
		// Wires currently in the project tree that the caller should remove.
		// Starts with removedWires; grows as splits/merges consume tree wires.
		const liveOriginalsToRemove = new Set<Wire>();
		// Wire instances created inside the integrator (not provided by the caller).
		// If they get consumed before becoming output, destroy them so they don't leak.
		const internalWires = new Set<Wire>();

		// Seed candidates and initial state from input.
		for (const w of addedWires) {
			if (w.length === 0) continue;
			const [s, e] = w.connectionPoints;
			addCandidate(s);
			addCandidate(e);
			freshLive.add(w);
		}
		for (const w of removedWires) {
			const [s, e] = w.connectionPoints;
			addCandidate(s);
			addCandidate(e);
			liveOriginalsToRemove.add(w);
		}
		for (const { wire, oldSnapshot } of movedWires) {
			if (wire.length !== 0) {
				const [s, e] = wire.connectionPoints;
				addCandidate(s);
				addCandidate(e);
			}
			addCandidate(oldSnapshot.start);
			addCandidate(oldSnapshot.end);
		}
		for (const p of addedComponentPorts) addCandidate(p);
		for (const p of removedComponentPorts) addCandidate(p);
		for (const { oldPorts, newPorts } of movedComponentPorts) {
			for (const p of oldPorts) addCandidate(p);
			for (const p of newPorts) addCandidate(p);
		}

		// Net port-presence delta at each position relative to what queries return.
		// Moved component ports already sit at newPorts in the project tree, so queries
		// reflect newPorts already; we only need -1 for oldPorts to mask the obsolete
		// positions (which queries no longer return anyway — but a stationary port at
		// the same coordinate would still be counted correctly).
		const portDelta = new Map<string, number>();
		const bumpPort = (p: Point, delta: number) => {
			const k = pointKey(p);
			portDelta.set(k, (portDelta.get(k) ?? 0) + delta);
		};
		for (const p of addedComponentPorts) bumpPort(p, 1);
		for (const p of removedComponentPorts) bumpPort(p, -1);
		for (const { oldPorts } of movedComponentPorts) {
			for (const p of oldPorts) bumpPort(p, -1);
		}

		// hasPort: does the post-state contain a port at P?
		const hasPort = (p: Point): boolean => {
			const queryRect = new Rectangle(p.x - 1, p.y - 1, 2, 2);
			let count = 0;
			for (const comp of queryComponentsInRange(queryRect)) {
				for (const port of comp.connectionPoints) {
					if (port.x === p.x && port.y === p.y) count++;
				}
			}
			count += portDelta.get(pointKey(p)) ?? 0;
			return count > 0;
		};

		// Returns the wires in the working set whose gridBounds touch a 2×2 rect around P.
		// Working set = (project tree query) − liveOriginalsToRemove + freshLive.
		const collectWorkingWiresAt = (p: Point): Wire[] => {
			const queryRect = new Rectangle(p.x - 1, p.y - 1, 2, 2);
			const result: Wire[] = [];
			for (const w of queryWiresInRange(queryRect)) {
				if (liveOriginalsToRemove.has(w)) continue;
				if (freshLive.has(w)) continue; // avoid duplicating an instance that lives in both
				result.push(w);
			}
			for (const w of freshLive) {
				if (w.gridBounds.intersects(queryRect)) {
					result.push(w);
				}
			}
			return result;
		};

		const consumeFresh = (w: Wire): boolean => {
			if (freshLive.has(w)) {
				freshLive.delete(w);
				if (internalWires.has(w)) {
					internalWires.delete(w);
					if (!w.destroyed) w.destroy();
				}
				return true;
			}
			return false;
		};
		const consumeWire = (w: Wire) => {
			if (!consumeFresh(w)) {
				liveOriginalsToRemove.add(w);
			}
		};

		// Consolidate pass: absorb collinear-overlapping wires into a single one. This
		// runs once per added/moved wire. Without it, the split pass would split each
		// participant of an overlap and produce duplicate pieces — overlaps are only
		// possible because a caller-provided wire may have been drawn or moved onto an
		// existing collinear span, and the integrator's job is to restore invariants.
		const consolidateWire = (initialWire: Wire) => {
			let mergedW = initialWire;
			let changed = true;
			while (changed) {
				changed = false;
				const bounds = mergedW.gridBounds;
				const collinear: Wire[] = [];
				for (const c of queryWiresInRange(bounds)) {
					if (c === mergedW) continue;
					if (liveOriginalsToRemove.has(c)) continue;
					if (freshLive.has(c)) continue;
					collinear.push(c);
				}
				for (const c of freshLive) {
					if (c === mergedW) continue;
					if (c.gridBounds.intersects(bounds)) collinear.push(c);
				}

				for (const c of collinear) {
					if (c.direction !== mergedW.direction) continue;
					if (!this._isSameAxis(mergedW, c)) continue;
					const aStart = this._axisPos(mergedW);
					const aEnd = aStart + mergedW.length;
					const cStart = this._axisPos(c);
					const cEnd = cStart + c.length;
					const overlapStart = Math.max(aStart, cStart);
					const overlapEnd = Math.min(aEnd, cEnd);
					if (overlapStart >= overlapEnd) continue;

					const newMerged = Wire.merge(mergedW, c);
					newMerged.applyScale(scale);
					internalWires.add(newMerged);
					consumeWire(mergedW);
					consumeWire(c);
					mergedW = newMerged;
					freshLive.add(mergedW);
					const [ms, me] = mergedW.connectionPoints;
					addCandidate(ms);
					addCandidate(me);
					changed = true;
					break;
				}
			}
		};

		for (const w of addedWires) {
			if (w.length === 0) continue;
			if (!freshLive.has(w)) continue;
			consolidateWire(w);
		}
		for (const { wire } of movedWires) {
			if (wire.length === 0) continue;
			if (liveOriginalsToRemove.has(wire)) continue;
			consolidateWire(wire);
		}

		// Seed candidates with stationary endpoints/ports that lie strictly inside an
		// added or moved wire's body — these are the points that force a split-on-add.
		const scanForInteriorCandidates = (w: Wire) => {
			if (w.length === 0 || w.destroyed) return;
			const bounds = w.gridBounds;
			for (const existing of queryWiresInRange(bounds)) {
				if (existing === w) continue;
				if (liveOriginalsToRemove.has(existing)) continue;
				const [s, e] = existing.connectionPoints;
				if (this._interiorContains(w, s)) addCandidate(s);
				if (this._interiorContains(w, e)) addCandidate(e);
			}
			for (const comp of queryComponentsInRange(bounds)) {
				for (const port of comp.connectionPoints) {
					if (this._interiorContains(w, port)) addCandidate(port);
				}
			}
		};
		// Scan all current freshLive wires (consolidate may have produced new ones
		// in place of the caller's addedWires).
		for (const w of freshLive) scanForInteriorCandidates(w);
		// Plus any moved wires that survived consolidation (they live in the project
		// tree, not in freshLive).
		for (const { wire } of movedWires) {
			if (liveOriginalsToRemove.has(wire)) continue;
			scanForInteriorCandidates(wire);
		}

		// isTermination: P is a candidate for being "inside W's interior in violation
		// of I1/I2". A split is only justified if P is actually a termination of
		// something else — a candidate that drifted in from a removal/move without a
		// current terminator there must not trigger a spurious split.
		const isTermination = (p: Point, excludeWire: Wire): boolean => {
			if (hasPort(p)) return true;
			for (const w of collectWorkingWiresAt(p)) {
				if (w === excludeWire) continue;
				if (this._endpointEquals(w, p)) return true;
			}
			return false;
		};

		// Fixed-point loop. Each pass snapshots the candidate set so cascading updates
		// land in the next iteration — this keeps iteration order independent of the
		// hash-iteration order of the Map.
		let iteration = 0;
		let changed = true;
		while (changed) {
			if (iteration >= MAX_ITERATIONS) {
				throw new Error(
					`WireIntegrator: fixed-point loop did not converge in ${MAX_ITERATIONS} iterations`
				);
			}
			iteration++;
			changed = false;

			// --- Split pass ---
			// For each candidate point P, split any wire whose interior contains P,
			// but only if some OTHER termination (endpoint or port) sits at P — i.e.,
			// the I1/I2 invariant is actually violated. Pure candidates left over
			// from a removal/move with no current terminator must not cause a split.
			const splitSnapshot = [...candidates.values()];
			for (const p of splitSnapshot) {
				for (const w of collectWorkingWiresAt(p)) {
					if (!this._interiorContains(w, p)) continue;
					if (!isTermination(p, w)) continue;
					const [w1, w2] = this._splitWire(w, p, scale);
					internalWires.add(w1);
					internalWires.add(w2);
					consumeWire(w);
					freshLive.add(w1);
					freshLive.add(w2);
					const [s1, e1] = w1.connectionPoints;
					const [s2, e2] = w2.connectionPoints;
					addCandidate(s1);
					addCandidate(e1);
					addCandidate(s2);
					addCandidate(e2);
					changed = true;
				}
			}

			// --- Merge pass ---
			// For each candidate point P, find pairs of collinear wires (same axis,
			// each ending at P) and merge them iff nothing else terminates at P.
			const mergeSnapshot = [...candidates.values()];
			for (const p of mergeSnapshot) {
				for (const direction of [
					WireDirection.HORIZONTAL,
					WireDirection.VERTICAL
				]) {
					const ending = collectWorkingWiresAt(p).filter(
						(w) => w.direction === direction && this._endpointEquals(w, p)
					);
					if (ending.length !== 2) continue;
					if (
						this._hasThirdTerminatorAt(
							p,
							ending,
							collectWorkingWiresAt,
							hasPort
						)
					)
						continue;

					const [wa, wb] = ending;
					const merged = Wire.merge(wa, wb);
					merged.applyScale(scale);
					internalWires.add(merged);
					consumeWire(wa);
					consumeWire(wb);
					freshLive.add(merged);
					addCandidate(merged.connectionPoints[0]);
					addCandidate(merged.connectionPoints[1]);
					changed = true;
				}
			}
		}

		return {
			toAdd: [...freshLive],
			toRemove: [...liveOriginalsToRemove]
		};
	}

	private _interiorContains(w: Wire, p: Point): boolean {
		if (!w.contains(p)) return false;
		return !this._endpointEquals(w, p);
	}

	private _endpointEquals(w: Wire, p: Point): boolean {
		const [s, e] = w.connectionPoints;
		return (s.x === p.x && s.y === p.y) || (e.x === p.x && e.y === p.y);
	}

	private _splitWire(w: Wire, p: Point, scale: number): [Wire, Wire] {
		const [w1, w2] = Wire.split(w, p);
		w1.applyScale(scale);
		w2.applyScale(scale);
		return [w1, w2];
	}

	private _hasThirdTerminatorAt(
		p: Point,
		exclude: readonly Wire[],
		collectWorkingWiresAt: (p: Point) => Wire[],
		hasPort: (p: Point) => boolean
	): boolean {
		if (hasPort(p)) return true;
		const excludeSet = new Set(exclude);
		for (const w of collectWorkingWiresAt(p)) {
			if (excludeSet.has(w)) continue;
			if (this._endpointEquals(w, p)) return true;
		}
		return false;
	}

	private _axisPos(w: Wire): number {
		return w.direction === WireDirection.HORIZONTAL
			? w.position.x
			: w.position.y;
	}

	private _isSameAxis(a: Wire, b: Wire): boolean {
		if (a.direction === WireDirection.HORIZONTAL) {
			return a.position.y === b.position.y;
		}
		return a.position.x === b.position.x;
	}
}
