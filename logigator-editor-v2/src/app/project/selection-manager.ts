import { Rectangle } from 'pixi.js';
import { Observable, Subject } from 'rxjs';
import { WorkMode } from '../work-mode/work-mode.enum';
import { Component } from '../components/component';
import { Wire } from '../wires/wire';
import { cutWire } from '../wires/wire-cut';
import { AddWiresAction } from '../actions/actions/add-wires.action';
import { RemoveWiresAction } from '../actions/actions/remove-wires.action';
import { ActionContainer } from '../actions/action-container';
import type { Project } from './project';

export class SelectionManager {
	static readonly SELECTION_TINT = 0x888888;

	private readonly _selectedComponents = new Set<Component>();
	private readonly _selectedWires = new Set<Wire>();
	private readonly _selectionChange$ = new Subject<void>();

	constructor(private readonly project: Project) {}

	public commit(rect: Rectangle, mode: WorkMode): void {
		if (rect.width === 0 && rect.height === 0) {
			this._commitSingleClick(rect.x, rect.y);
		} else {
			this._commitRect(rect, mode);
		}
	}

	private _commitRect(rect: Rectangle, mode: WorkMode): void {
		this.clear();

		for (const component of this.project.queryComponentsInRange(rect)) {
			component.tint = SelectionManager.SELECTION_TINT;
			this._selectedComponents.add(component);
		}

		if (mode === WorkMode.SELECT_EXACT) {
			this._scissorAndSelectWires(rect);
		} else {
			for (const wire of this.project.queryWiresInRange(rect)) {
				wire.tint = SelectionManager.SELECTION_TINT;
				this._selectedWires.add(wire);
			}
		}

		this._selectionChange$.next();
	}

	private _scissorAndSelectWires(rect: Rectangle): void {
		// Snapshot before mutating: queryWiresInRange returns a single-use generator
		// and the quad-tree is updated synchronously by RemoveWiresAction.do().
		const candidates = Array.from(this.project.queryWiresInRange(rect));

		const wiresToKeep: Wire[] = [];
		const toRemove: Wire[] = [];
		const toAdd: Wire[] = [];
		const insideIds = new Set<number>();

		for (const wire of candidates) {
			const result = cutWire(wire, rect);
			if (result.kind === 'skip') continue;
			if (result.kind === 'keep') {
				wiresToKeep.push(wire);
				continue;
			}
			toRemove.push(wire);
			result.pieces.forEach((p, idx) => {
				const newWire = new Wire(p.direction, p.length);
				newWire.position.set(p.position.x, p.position.y);
				toAdd.push(newWire);
				if (idx === result.insideIndex) {
					insideIds.add(newWire.id);
				}
			});
		}

		if (toRemove.length > 0) {
			this.project.actionManager.push(
				new ActionContainer(
					new RemoveWiresAction(...toRemove),
					new AddWiresAction(...toAdd)
				)
			);
			// AddWiresAction serializes its input at construction time and creates
			// fresh Wire instances inside do() via deserialize; the toAdd wires are
			// orphans that never enter the scene, so destroy them to release the
			// PixiJS Graphics state.
			for (const orphan of toAdd) orphan.destroy();
		}

		for (const wire of wiresToKeep) {
			if (wire.destroyed) continue;
			wire.tint = SelectionManager.SELECTION_TINT;
			this._selectedWires.add(wire);
		}

		// Inside pieces are identified by ID: the post-cut quad-tree may also
		// contain outside pieces (their gridBounds half-cell padding intersects a
		// non-integer rect), but those IDs are not in insideIds and stay
		// unselected.
		if (insideIds.size > 0) {
			for (const wire of this.project.queryWiresInRange(rect)) {
				if (!wire.destroyed && insideIds.has(wire.id)) {
					wire.tint = SelectionManager.SELECTION_TINT;
					this._selectedWires.add(wire);
				}
			}
		}
	}

	// A zero-area rect fails PixiJS Rectangle.intersects(), so we build a 1×1
	// query rect and post-filter with gridBounds.contains().
	private _commitSingleClick(px: number, py: number): void {
		this.clear();

		const queryRect = new Rectangle(px - 0.5, py - 0.5, 1, 1);

		let bestComponent: Component | null = null;
		let bestComponentArea = Infinity;

		for (const component of this.project.queryComponentsInRange(queryRect)) {
			const bounds = component.gridBounds;
			if (!component.destroyed && bounds.contains(px, py)) {
				const area = bounds.width * bounds.height;
				if (area < bestComponentArea) {
					bestComponentArea = area;
					bestComponent = component;
				}
			}
		}

		let bestWire: Wire | null = null;
		let bestWireArea = Infinity;

		for (const wire of this.project.queryWiresInRange(queryRect)) {
			const bounds = wire.gridBounds;
			if (!wire.destroyed && bounds.contains(px, py)) {
				const area = bounds.width * bounds.height;
				if (area < bestWireArea) {
					bestWireArea = area;
					bestWire = wire;
				}
			}
		}

		// Tie-break: smaller bounding-box area = more precisely-aimed target.
		if (bestComponent !== null && (bestWire === null || bestComponentArea <= bestWireArea)) {
			bestComponent.tint = SelectionManager.SELECTION_TINT;
			this._selectedComponents.add(bestComponent);
		} else if (bestWire !== null) {
			bestWire.tint = SelectionManager.SELECTION_TINT;
			this._selectedWires.add(bestWire);
		}

		this._selectionChange$.next();
	}

	public clear(): void {
		for (const component of this._selectedComponents) {
			if (!component.destroyed) {
				component.tint = 0xffffff;
			}
		}
		for (const wire of this._selectedWires) {
			if (!wire.destroyed) {
				wire.tint = 0xffffff;
			}
		}
		this._selectedComponents.clear();
		this._selectedWires.clear();
		this._selectionChange$.next();
	}

	// Called from Project.removeComponent/removeWire before destroy() to prevent
	// the set from holding a dead Container reference.
	public evict(element: Component | Wire): void {
		let changed: boolean;
		if (element instanceof Component) {
			changed = this._selectedComponents.delete(element);
		} else {
			changed = this._selectedWires.delete(element);
		}
		if (changed) {
			this._selectionChange$.next();
		}
	}

	public containsPoint(gridPoint: { x: number; y: number }): boolean {
		for (const component of this._selectedComponents) {
			if (
				!component.destroyed &&
				component.gridBounds.contains(gridPoint.x, gridPoint.y)
			) {
				return true;
			}
		}
		for (const wire of this._selectedWires) {
			if (
				!wire.destroyed &&
				wire.gridBounds.contains(gridPoint.x, gridPoint.y)
			) {
				return true;
			}
		}
		return false;
	}

	public boundingBox(): Rectangle | null {
		if (this.isEmpty) return null;

		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;

		for (const component of this._selectedComponents) {
			if (component.destroyed) continue;
			const b = component.gridBounds;
			if (b.x < minX) minX = b.x;
			if (b.y < minY) minY = b.y;
			if (b.right > maxX) maxX = b.right;
			if (b.bottom > maxY) maxY = b.bottom;
		}

		for (const wire of this._selectedWires) {
			if (wire.destroyed) continue;
			const b = wire.gridBounds;
			if (b.x < minX) minX = b.x;
			if (b.y < minY) minY = b.y;
			if (b.right > maxX) maxX = b.right;
			if (b.bottom > maxY) maxY = b.bottom;
		}

		if (minX === Infinity) return null;
		return new Rectangle(minX, minY, maxX - minX, maxY - minY);
	}

	public get isEmpty(): boolean {
		return (
			this._selectedComponents.size === 0 && this._selectedWires.size === 0
		);
	}

	public get selectionChange$(): Observable<void> {
		return this._selectionChange$.asObservable();
	}

	public get selectedComponents(): ReadonlySet<Component> {
		return this._selectedComponents;
	}

	public get selectedWires(): ReadonlySet<Wire> {
		return this._selectedWires;
	}
}
