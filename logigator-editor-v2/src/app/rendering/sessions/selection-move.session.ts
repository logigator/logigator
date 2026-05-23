import { Container, FederatedPointerEvent, Point, Rectangle } from 'pixi.js';
import { DragSession } from '../drag-session';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { ConnectionPoint } from '../../connection-points/connection-point';
import { roundToGrid } from '../../utils/grid';
import { ActionContainer } from '../../actions/action-container';
import { MoveComponentsAction } from '../../actions/actions/move-components.action';
import { MoveWiresAction } from '../../actions/actions/move-wires.action';
import { RemoveWiresAction } from '../../actions/actions/remove-wires.action';
import { AddWiresAction } from '../../actions/actions/add-wires.action';
import { MoveEntry } from '../../actions/actions/move-entry.model';
import { SerializedWire } from '../../wires/serialized-wire.model';

export class SelectionMoveSession implements DragSession {
	private readonly _components: Component[];
	private readonly _wires: Wire[];
	private readonly _pointerStart: Point;
	private _hasCollision = false;
	private _capturedCps: ConnectionPoint[] = [];

	constructor(
		private readonly project: Project,
		private readonly dragLayer: Container<Component | Wire | ConnectionPoint>,
		components: ReadonlySet<Component>,
		wires: ReadonlySet<Wire>,
		pointerStart: Point
	) {
		this._components = [...components];
		this._wires = [...wires];
		this._pointerStart = pointerStart;

		project.detachForDrag(this._components, this._wires);
		for (const c of this._components) dragLayer.addChild(c);
		for (const w of this._wires) dragLayer.addChild(w);
		// dragLayer starts at (0,0) offset; selection was non-overlapping before
		// detach, so no initial collision check is needed.
		this._capturedCps = project.connectionPoints.captureDragCps(
			this._components,
			this._wires,
			dragLayer
		);
	}

	onMove(e: FederatedPointerEvent): void {
		const gridPos = roundToGrid(
			e.getLocalPosition(this.project.gridSpace),
			true
		);
		this.dragLayer.position.set(
			gridPos.x - this._pointerStart.x,
			gridPos.y - this._pointerStart.y
		);
		this._updateCollision();
	}

	canEnd(): boolean {
		return !this._hasCollision;
	}

	onEnd(): void {
		const delta = this.dragLayer.position.clone();
		const hasMove = delta.x !== 0 || delta.y !== 0;

		// All captures here happen BEFORE the delta is applied — wires and components
		// are still at their pre-drag positions.
		const wireSnapshots: SerializedWire[] = this._wires.map((w) =>
			Wire.serialize(w)
		);
		const oldWireSnapshots = this._wires.map((w) => Wire.snapshot(w));
		const componentOldPorts = new Map<number, readonly Point[]>(
			this._components.map((c) => [c.id, c.connectionPoints])
		);
		const componentOldPos = new Map(
			this._components.map((c) => [c.id, c.position.clone()])
		);

		for (const child of this.dragLayer.children) {
			if (child instanceof ConnectionPoint) continue;
			child.position.set(
				child.position.x + delta.x,
				child.position.y + delta.y
			);
		}

		this.dragLayer.position.set(0, 0);
		this.dragLayer.tint = 0xffffff;
		this._hasCollision = false;
		this.project.reattachFromDrag(this._components, this._wires);

		if (!hasMove) {
			this.project.connectionPoints.restoreDragCps(this._capturedCps);
			return;
		}

		this.project.connectionPoints.discardDragCps(this._capturedCps);
		this.project.connectionPoints.recomputeCpsForMovedSelection(
			componentOldPorts,
			oldWireSnapshots,
			this._components,
			this._wires
		);

		const action = new ActionContainer();

		if (this._components.length > 0) {
			const componentEntries: MoveEntry[] = this._components.map((c) => ({
				id: c.id,
				oldPos: componentOldPos.get(c.id)!,
				newPos: c.position.clone()
			}));
			action.add(new MoveComponentsAction(...componentEntries));
		}

		if (this._wires.length > 0) {
			const { toAdd, toRemove } = this.project.computeWireIntegration(
				this._wires
			);

			if (toRemove.length > 0) {
				// Any merge occurred (with external wires or between moved wires themselves).
				// Use Remove+Add to record the full before/after state.
				// Moved wires are recorded at their OLD positions (wireSnapshots) so undo
				// correctly restores them at the original location.
				const absorbed = toRemove.filter((w) => !this._wires.includes(w));
				const absorbedSnapshots = absorbed.map((w) => Wire.serialize(w));
				action.add(
					new RemoveWiresAction(...wireSnapshots, ...absorbedSnapshots)
				);
				action.add(new AddWiresAction(...toAdd));
			} else {
				// Simple move — no merges occurred.
				const wireEntries: MoveEntry[] = wireSnapshots.map((snap, i) => ({
					id: snap.id,
					oldPos: new Point(snap.pos[0] + 0.5, snap.pos[1] + 0.5),
					newPos: this._wires[i].position.clone()
				}));
				action.add(new MoveWiresAction(...wireEntries));
			}
		}

		if (action.length > 0) {
			this.project.actionManager.push(action);
		}
	}

	onCancel(): void {
		this.dragLayer.position.set(0, 0);
		this.dragLayer.tint = 0xffffff;
		this._hasCollision = false;
		this.project.reattachFromDrag(this._components, this._wires);
		this.project.connectionPoints.restoreDragCps(this._capturedCps);
	}

	private _boundsWorld(comp: Component): Rectangle {
		const b = comp.gridBounds;
		return new Rectangle(
			b.x + this.dragLayer.position.x,
			b.y + this.dragLayer.position.y,
			b.width,
			b.height
		);
	}

	private _bodyBoundsWorld(comp: Component): Rectangle {
		const b = comp.bodyGridBounds;
		return new Rectangle(
			b.x + this.dragLayer.position.x,
			b.y + this.dragLayer.position.y,
			b.width,
			b.height
		);
	}

	private _wireBoundsWorld(wire: Wire): Rectangle {
		const b = wire.gridBounds;
		return new Rectangle(
			b.x + this.dragLayer.position.x,
			b.y + this.dragLayer.position.y,
			b.width,
			b.height
		);
	}

	private _updateCollision(): void {
		const collision =
			this._components.some(
				(c) =>
					this.project.hasComponentCollision(this._boundsWorld(c)) ||
					this.project.hasComponentBodyWireCollision(this._bodyBoundsWorld(c))
			) ||
			this._wires.some((w) =>
				this.project.hasWireBodyCollision(this._wireBoundsWorld(w))
			);
		if (collision === this._hasCollision) return;
		this._hasCollision = collision;
		this.dragLayer.tint = collision ? 0xff4444 : 0xffffff;
	}
}
