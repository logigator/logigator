import {
	Container,
	FederatedPointerEvent,
	Graphics,
	Point,
	Rectangle
} from 'pixi.js';
import { WorkMode } from '../work-mode/work-mode.enum';
import { Project } from '../project/project';
import { Component } from '../components/component';
import { alignPointToGrid, toGridPoint } from '../utils/grid';
import { Subject } from 'rxjs';

export class FloatingLayer extends Container {
	private _dragStart: Point | null = null;

	private readonly _selection: Container<Component> = new Container();
	private readonly _selectRect: Graphics = new Graphics();

	constructor(
		private readonly project: Project,
		private readonly _ticker$: Subject<'on' | 'off' | 'single'>
	) {
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
		this._selection.tint = 0xbbbbbb;

		this._selectRect.rect(0, 0, 1, 1);
		this._selectRect.alpha = 0.3;
		this._selectRect.fill(0x0);

		this.addChild(this._selection);

		this.on('pointerdown', this.onPointerDown);
	}

	public updateScale(scale: number) {
		for (const child of this._selection.children) {
			child.applyScale(scale);
		}
	}

	private onPointerDown(e: FederatedPointerEvent) {
		if (this._dragStart) {
			return;
		}
		if (e.button !== 0) {
			return;
		}

		this._dragStart = e.global.clone();

		this.position = alignPointToGrid(e.getLocalPosition(this.project), true);

		switch (this.project.mode) {
			case WorkMode.COMPONENT_PLACEMENT:
				this.placeComponentInSelection(new Point(0, 0));
				break;
			case WorkMode.SELECT:
				this._selectRect.scale.set(0, 0);
				this.addChild(this._selectRect);
				break;
		}

		this._ticker$.next('on');

		this.on('pointerup', this.onPointerUp);
		this.on('pointerupoutside', this.onPointerUp);
		this.on('pointermove', this.onPointerMove);
	}

	private onPointerMove(e: FederatedPointerEvent) {
		if (!this._dragStart) {
			return;
		}

		switch (this.project.mode) {
			case WorkMode.COMPONENT_PLACEMENT:
				this.position = alignPointToGrid(
					e.getLocalPosition(this.project),
					true
				);
				break;
			case WorkMode.SELECT:
				this.position = this.project.toLocal(
					new Point(
						Math.min(this._dragStart.x, e.global.x),
						Math.min(this._dragStart.y, e.global.y)
					)
				);
				this._selectRect.scale.set(
					Math.abs(this._dragStart.x - e.global.x) / this.project.scale.x,
					Math.abs(this._dragStart.y - e.global.y) / this.project.scale.y
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

		switch (this.project.mode) {
			case WorkMode.COMPONENT_PLACEMENT:
				this.commitSelection();
				break;
		}

		this._ticker$.next('off');

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

		this._selection.addChild(component);
	}

	private commitSelection() {
		for (const child of this._selection.children) {
			this.project.addComponent(
				child,
				toGridPoint(this.position.add(child.position), true)
			);
		}

		this._selection.removeChildren(0);
	}
}
