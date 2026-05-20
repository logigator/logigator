import {
	Container,
	DestroyOptions,
	FederatedPointerEvent,
	Graphics,
	Point,
	Rectangle
} from 'pixi.js';
import { WorkMode } from '../work-mode/work-mode.enum';
import { Project } from '../project/project';
import { Component } from '../components/component';
import { roundToGrid, roundToHalfGrid } from '../utils/grid';
import { environment } from '../../environments/environment';
import { Subject } from 'rxjs';
import { AddComponentsAction } from '../actions/actions/add-components.action';
import { ComponentConfig } from '../components/component-config.model';
import { Wire } from '../wires/wire';
import { AddWiresAction } from '../actions/actions/add-wires.action';
import { WireDirection } from '../wires/wire-direction.enum';
import { ActionContainer } from '../actions/action-container';

export class FloatingLayer extends Container {
	private readonly _componentGhost = new Container<Component>();
	private readonly _wirePreview = new Container<Wire>();
	private readonly _selectRect: Graphics = new Graphics();

	private readonly destroy$ = new Subject<void>();

	private _mode: WorkMode = WorkMode.WIRE_DRAWING;
	private _componentToPlace: ComponentConfig | null = null;
	private _dragStart: Point | null = null;
	private _wireDragDirection: WireDirection | null = null;

	constructor(private readonly project: Project) {
		super();

		this.interactiveChildren = false;
		this.eventMode = 'static';

		this.boundsArea = new Rectangle(
			-Number.MAX_VALUE / 2,
			-Number.MAX_VALUE / 2,
			Number.MAX_VALUE,
			Number.MAX_VALUE
		);
		this.hitArea = this.boundsArea;
		this._componentGhost.tint = 0xbbbbbb;

		this._selectRect.rect(0, 0, 1, 1);
		this._selectRect.alpha = 0.3;
		this._selectRect.fill(0x0);

		this.addChild(this._componentGhost);
		this.addChild(this._wirePreview);

		this.on('pointerdown', this.onPointerDown);
	}

	public updateScale(scale: number) {
		for (const child of this._componentGhost.children) {
			child.applyScale(scale);
		}

		for (const child of this._wirePreview.children) {
			child.applyScale(scale);
		}
	}

	public get mode(): WorkMode {
		return this._mode;
	}

	public set mode(value: WorkMode) {
		this.clearSelection();
		this.project.selectionManager.clear();
		this._mode = value;
		this.project.triggerTicker('single');
	}

	public get componentToPlace(): ComponentConfig | null {
		return this._componentToPlace;
	}

	public set componentToPlace(value: ComponentConfig | null) {
		this._componentToPlace = value;
	}

	private onPointerDown(e: FederatedPointerEvent) {
		if (this._dragStart) {
			return;
		}
		if (e.button !== 0) {
			return;
		}

		this._dragStart = e.global.clone();

		switch (this._mode) {
			case WorkMode.COMPONENT_PLACEMENT:
				this.position = roundToGrid(
					e.getLocalPosition(this.project.gridSpace),
					true
				);
				this.placeComponentInSelection(new Point(0, 0));
				break;
			case WorkMode.WIRE_DRAWING:
				this.position = roundToHalfGrid(
					e.getLocalPosition(this.project.gridSpace),
					true
				);
				this._wireDragDirection = null;
				break;
			case WorkMode.SELECT:
			case WorkMode.SELECT_EXACT: {
				const localPoint = e.getLocalPosition(this.project.gridSpace);
				if (
					!this.project.selectionManager.isEmpty &&
					this.project.selectionManager.containsPoint(localPoint)
				) {
					// Click inside existing selection — future drag-move entry point.
					// Clear _dragStart so the guard at the top of onPointerDown resets.
					this._dragStart = null;
					return;
				}
				this.position = localPoint;
				this._selectRect.scale.set(0, 0);
				this.addChild(this._selectRect);
				break;
			}
		}

		this.project.triggerTicker('on');

		this.on('pointerup', this.onPointerUp);
		this.on('pointerupoutside', this.onPointerUp);
		this.on('pointermove', this.onPointerMove);
	}

	private onPointerMove(e: FederatedPointerEvent) {
		if (!this._dragStart) {
			return;
		}

		switch (this._mode) {
			case WorkMode.COMPONENT_PLACEMENT:
				this.position = roundToGrid(
					e.getLocalPosition(this.project.gridSpace),
					true
				);
				break;
			case WorkMode.WIRE_DRAWING:
				this.handleMouseMoveWhilePlacingWire(e);
				break;
			case WorkMode.SELECT:
			case WorkMode.SELECT_EXACT:
				// _selectRect lives in gridSpace, so its scale must be in grid units.
				// Convert screen-pixel delta → grid units via projectScale * gridSize.
				this._selectRect.scale.set(
					(e.global.x - this._dragStart.x) /
						(this.project.scale.x * environment.gridSize),
					(e.global.y - this._dragStart.y) /
						(this.project.scale.y * environment.gridSize)
				);
		}
	}

	private onPointerUp() {
		if (!this._dragStart) {
			return;
		}

		this.off('pointerup', this.onPointerUp);
		this.off('pointerupoutside', this.onPointerUp);
		this.off('pointermove', this.onPointerMove);

		switch (this._mode) {
			case WorkMode.COMPONENT_PLACEMENT:
			case WorkMode.WIRE_DRAWING:
				this.commitSelection();
				break;
			case WorkMode.SELECT:
			case WorkMode.SELECT_EXACT: {
				const rect = this.normalizeSelectRect();
				this.removeChild(this._selectRect);
				this.project.selectionManager.commit(rect, this._mode);
				break;
			}
		}

		this.project.triggerTicker('off');

		this._dragStart = null;
	}

	private placeComponentInSelection(pos: Point) {
		if (!this.project.componentToPlace) {
			return;
		}

		const component = new this.project.componentToPlace.implementation(
			this.project.componentToPlace.options.map((x) => x.clone())
		);

		component.applyScale(this.project.scale.x);
		component.position = pos;

		this._componentGhost.addChild(component);
	}

	private handleMouseMoveWhilePlacingWire(e: FederatedPointerEvent) {
		const mouseAligned = roundToGrid(e.getLocalPosition(this), true);

		if (this._wireDragDirection === null) {
			if (mouseAligned.x === 0 && mouseAligned.y === 0) {
				return;
			}

			this._wireDragDirection =
				mouseAligned.x !== 0
					? WireDirection.HORIZONTAL
					: WireDirection.VERTICAL;

			this._wirePreview.addChild(new Wire(WireDirection.HORIZONTAL, 0));
			this._wirePreview.addChild(new Wire(WireDirection.VERTICAL, 0));

			for (const wire of this._wirePreview.children) {
				wire.applyScale(this.project.scale.x);
			}
		}

		const [horizontalWire, verticalWire] = this._wirePreview.children as [
			Wire,
			Wire
		];

		horizontalWire.position.x = Math.min(0, mouseAligned.x);
		verticalWire.position.y = Math.min(0, mouseAligned.y);

		horizontalWire.length = Math.abs(mouseAligned.x);
		verticalWire.length = Math.abs(mouseAligned.y);

		if (this._wireDragDirection === WireDirection.HORIZONTAL) {
			verticalWire.position.x = mouseAligned.x;
		} else {
			horizontalWire.position.y = mouseAligned.y;
		}
	}

	private commitSelection() {
		const action = new ActionContainer();

		if (this._componentGhost.children.length > 0) {
			for (const child of this._componentGhost.children) {
				child.position = child.position.add(this.position);
			}
			action.add(new AddComponentsAction(...this._componentGhost.children));
		}

		const wires = this._wirePreview.children.filter((x) => x.length > 0);
		if (wires.length > 0) {
			for (const child of wires) {
				child.position = child.position.add(this.position);
			}
			action.add(new AddWiresAction(...wires));
		}

		if (action.length > 0) {
			this.project.actionManager.push(action);
		}

		this.clearSelection();
	}

	private clearSelection() {
		for (const child of [...this._componentGhost.children]) {
			child.destroy({ children: true });
		}
		this._componentGhost.removeChildren(0);

		for (const child of [...this._wirePreview.children]) {
			child.destroy({ children: true });
		}
		this._wirePreview.removeChildren(0);

		this.removeChild(this._selectRect);
	}

	private normalizeSelectRect(): Rectangle {
		const sx = this._selectRect.scale.x;
		const sy = this._selectRect.scale.y;
		return new Rectangle(
			sx >= 0 ? this.position.x : this.position.x + sx,
			sy >= 0 ? this.position.y : this.position.y + sy,
			Math.abs(sx),
			Math.abs(sy)
		);
	}

	override destroy(options?: DestroyOptions) {
		this.destroy$.next();
		super.destroy(options);
	}
}
