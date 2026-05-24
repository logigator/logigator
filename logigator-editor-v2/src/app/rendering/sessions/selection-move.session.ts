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

		// If this drag started from a SELECT_EXACT selection with a tentative
		// scissor cut, fold that cut into the action so cut+move undo as one step.
		// On hasMove === false we returned above without claiming, leaving the
		// pending cut for the next selection-clear to roll back.
		const pendingCut = this.project.selectionManager.claimPendingCut();
		if (pendingCut) {
			action.add(pendingCut);
		}

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
				const mergeRemove = new RemoveWiresAction(
					...wireSnapshots,
					...absorbedSnapshots
				);
				const mergeAdd = new AddWiresAction(...toAdd);
				action.add(mergeRemove);
				action.add(mergeAdd);

				if (pendingCut) {
					// We'll register (not push) below — push's do() pass would re-run
					// the cut container, which would re-deserialize wires with IDs
					// already in the quad tree and produce duplicates. Apply the
					// merge mutations manually so the project ends up in the same
					// state push() would have produced.
					mergeRemove.do(this.project);
					mergeAdd.do(this.project);
				}
			} else {
				// Simple move — no merges occurred. Positions are already at post-move
				// (lines above), so MoveWiresAction.do is idempotent if push() runs.
				const wireEntries: MoveEntry[] = wireSnapshots.map((snap, i) => ({
					id: snap.id,
					oldPos: new Point(snap.pos[0] + 0.5, snap.pos[1] + 0.5),
					newPos: this._wires[i].position.clone()
				}));
				action.add(new MoveWiresAction(...wireEntries));
			}
		}

		if (action.length > 0) {
			if (pendingCut) {
				// Cut + move state is already fully materialized in the project
				// (cut at scissor time, positions in the move loop above, merges
				// just now). register() records the action without re-running its
				// do() — which would otherwise re-deserialize cut pieces with
				// IDs already in the quad tree.
				this.project.actionManager.register(action);
			} else {
				this.project.actionManager.push(action);
			}
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
