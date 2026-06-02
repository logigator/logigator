import { Container, FederatedPointerEvent, Point, Rectangle } from 'pixi.js';
import { DragSession } from '../drag-session';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { ComponentConfig } from '../../components/component-config.model';
import { Wire } from '../../wires/wire';
import { ConnectionPoint } from '../../connection-points/connection-point';
import { roundToGrid } from '../../utils/grid';
import { AddComponentsAction } from '../../actions/actions/add-components.action';
import { ActionContainer } from '../../actions/action-container';
import { RemoveWiresAction } from '../../actions/actions/remove-wires.action';
import { AddWiresAction } from '../../actions/actions/add-wires.action';
import { getStaticDI } from '../../utils/get-di';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { ComponentProviderService } from '../../components/component-provider.service';

export class ComponentPlacementSession implements DragSession {
	private readonly _component: Component;
	private _hasCollision = false;

	constructor(
		private readonly project: Project,
		private readonly dragLayer: Container<Component | Wire | ConnectionPoint>,
		startPos: Point
	) {
		const config = ComponentPlacementSession._resolvePlacementConfig(
			project.componentToPlace!
		);
		const options = Object.fromEntries(
			Object.entries(config.options).map(([key, opt]) => [key, opt.clone()])
		);
		this._component = config.create(options);
		this._component.tint = 0x888888;
		this._component.applyScale(project.scale.x);
		this._component.position.set(0, 0);
		dragLayer.addChild(this._component);
		dragLayer.position.copyFrom(startPos);
		this._updateCollision();
	}

	onMove(e: FederatedPointerEvent): void {
		this.dragLayer.position.copyFrom(
			roundToGrid(e.getLocalPosition(this.project.gridSpace), true)
		);
		this._updateCollision();
	}

	canEnd(): boolean {
		return !this._hasCollision;
	}

	onEnd(): void {
		this._component.position.set(
			this.dragLayer.position.x,
			this.dragLayer.position.y
		);
		this.dragLayer.position.set(0, 0);

		// Splits any wire whose interior passes under one of the placed component's ports.
		const { toAdd, toRemove } = this.project.computeIntegration({
			addedComponentPorts: this._component.connectionPoints
		});

		const action = new ActionContainer();
		if (toRemove.length > 0) {
			action.add(new RemoveWiresAction(...toRemove));
		}
		action.add(new AddComponentsAction(this._component));
		if (toAdd.length > 0) {
			action.add(new AddWiresAction(...toAdd));
		}
		this.project.actionManager.push(action);

		this._component.destroy({ children: true });
	}

	onCancel(): void {
		this._component.destroy({ children: true });
		this.dragLayer.position.set(0, 0);
	}

	private _boundsWorld(): Rectangle {
		const b = this._component.gridBounds;
		return new Rectangle(
			this.dragLayer.position.x + b.x,
			this.dragLayer.position.y + b.y,
			b.width,
			b.height
		);
	}

	private _bodyBoundsWorld(): Rectangle {
		const b = this._component.bodyGridBounds;
		return new Rectangle(
			this.dragLayer.position.x + b.x,
			this.dragLayer.position.y + b.y,
			b.width,
			b.height
		);
	}

	private _updateCollision(): void {
		const collision =
			this.project.hasComponentCollision(
				this._boundsWorld(),
				this._bodyBoundsWorld()
			) ||
			this.project.hasComponentBodyWireCollision(
				this._bodyBoundsWorld(),
				new Set(),
				this._component.ignoresWireCollision
			);
		if (collision === this._hasCollision) return;
		this._hasCollision = collision;
		// Tint this._component directly (not dragLayer) to avoid multiplying
		// with the container's own tint, which would yield the wrong colour.
		this._component.tint = collision ? 0xff4444 : 0x888888;
	}

	/**
	 * The palette lists custom **masters**, but a placed instance must wrap a
	 * **frozen snapshot** of the master's current state (snapshot-at-place-time).
	 * So when the config to place is a master, snapshot it now and place from the
	 * snapshot's config; placing the same master after editing it yields a fresh
	 * snapshot with the new shape. Built-ins (and snapshot configs) pass through.
	 */
	private static _resolvePlacementConfig(
		config: ComponentConfig
	): ComponentConfig {
		const registry = getStaticDI(CustomComponentRegistry);
		const def = registry.getDefinition(config.type);
		if (def?.kind !== 'master') return config;
		const snapshot = registry.snapshot(def.typeId);
		return (
			getStaticDI(ComponentProviderService).getComponent(snapshot.typeId) ??
			config
		);
	}
}
