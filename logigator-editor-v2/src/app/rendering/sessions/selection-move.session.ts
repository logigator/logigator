import { Container, FederatedPointerEvent, Point, Rectangle } from 'pixi.js';
import { DragSession } from '../drag-session';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { roundToGrid } from '../../utils/grid';
import { ActionContainer } from '../../actions/action-container';
import { MoveComponentsAction } from '../../actions/actions/move-components.action';
import { MoveWiresAction } from '../../actions/actions/move-wires.action';
import { MoveEntry } from '../../actions/actions/move-entry.model';

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
		const componentEntries: MoveEntry[] = [];
		const wireEntries: MoveEntry[] = [];

		for (const child of this.dragLayer.children) {
			const oldPos = child.position.clone();
			child.position.set(
				child.position.x + delta.x,
				child.position.y + delta.y
			);
			if (hasMove) {
				const newPos = child.position.clone();
				if (child instanceof Component) {
					componentEntries.push({ id: child.id, oldPos, newPos });
				} else {
					wireEntries.push({ id: child.id, oldPos, newPos });
				}
			}
		}

		this.dragLayer.position.set(0, 0);
		this.dragLayer.tint = 0xffffff;
		this._hasCollision = false;
		this.project.reattachFromDrag(this._components, this._wires);

		if (hasMove) {
			const action = new ActionContainer();
			if (componentEntries.length > 0) {
				action.add(new MoveComponentsAction(...componentEntries));
			}
			if (wireEntries.length > 0) {
				action.add(new MoveWiresAction(...wireEntries));
			}
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
