import { Container, FederatedPointerEvent, Point } from 'pixi.js';
import { DragSession } from '../drag-session';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { roundToGrid } from '../../utils/grid';
import { AddComponentsAction } from '../../actions/actions/add-components.action';

export class ComponentPlacementSession implements DragSession {
	private readonly _component: Component;

	constructor(
		private readonly project: Project,
		private readonly dragLayer: Container<Component | Wire>,
		startPos: Point
	) {
		const config = project.componentToPlace!;
		this._component = new config.implementation(
			config.options.map((x) => x.clone())
		);
		this._component.tint = 0x888888;
		this._component.applyScale(project.scale.x);
		this._component.position.set(0, 0);
		dragLayer.addChild(this._component);
		dragLayer.position.copyFrom(startPos);
	}

	onMove(e: FederatedPointerEvent): void {
		this.dragLayer.position.copyFrom(
			roundToGrid(e.getLocalPosition(this.project.gridSpace), true)
		);
	}

	onEnd(): void {
		this._component.position.set(
			this.dragLayer.position.x,
			this.dragLayer.position.y
		);
		this.dragLayer.position.set(0, 0);
		this.project.actionManager.push(new AddComponentsAction(this._component));
		this._component.destroy({ children: true });
	}

	onCancel(): void {
		this._component.destroy({ children: true });
		this.dragLayer.position.set(0, 0);
	}
}
