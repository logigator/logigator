import { Container, FederatedPointerEvent, Point, Rectangle } from 'pixi.js';
import { DragSession } from '../drag-session';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
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

	constructor(
		private readonly project: Project,
		private readonly dragLayer: Container<Component | Wire>,
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

		// Capture wire snapshots at old positions BEFORE applying the delta.
		const wireSnapshots: SerializedWire[] = this._wires.map((w) =>
			Wire.serialize(w)
		);

		// Capture component old positions before applying the delta.
		const componentOldPos = new Map(
			this._components.map((c) => [c.id, c.position.clone()])
		);

		for (const child of this.dragLayer.children) {
			child.position.set(
				child.position.x + delta.x,
				child.position.y + delta.y
			);
		}

		this.dragLayer.position.set(0, 0);
		this.dragLayer.tint = 0xffffff;
		this._hasCollision = false;
		this.project.reattachFromDrag(this._components, this._wires);

		if (!hasMove) return;

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

	private _updateCollision(): void {
		const collision = this._components.some((c) =>
			this.project.hasComponentCollision(this._boundsWorld(c))
		);
		if (collision === this._hasCollision) return;
		this._hasCollision = collision;
		this.dragLayer.tint = collision ? 0xff4444 : 0xffffff;
	}
}
