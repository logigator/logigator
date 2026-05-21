import { Container, FederatedPointerEvent, Point } from 'pixi.js';
import { DragSession } from '../drag-session';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { WireDirection } from '../../wires/wire-direction.enum';
import { AddWiresAction } from '../../actions/actions/add-wires.action';

export class WireDrawingSession implements DragSession {
	private _direction: WireDirection | null = null;
	private _h: Wire | null = null;
	private _v: Wire | null = null;

	constructor(
		private readonly project: Project,
		private readonly dragLayer: Container<Component | Wire>,
		private readonly startPos: Point
	) {}

	onMove(e: FederatedPointerEvent): void {
		const local = e.getLocalPosition(this.project.gridSpace);
		const dx = Math.round(local.x - this.startPos.x);
		const dy = Math.round(local.y - this.startPos.y);

		if (this._direction === null) {
			if (dx === 0 && dy === 0) return;
			this._direction =
				dx !== 0 ? WireDirection.HORIZONTAL : WireDirection.VERTICAL;
			this._h = new Wire(WireDirection.HORIZONTAL, 0);
			this._v = new Wire(WireDirection.VERTICAL, 0);
			this._h.applyScale(this.project.scale.x);
			this._v.applyScale(this.project.scale.x);
			this.dragLayer.addChild(this._h);
			this.dragLayer.addChild(this._v);
		}

		const h = this._h!;
		const v = this._v!;

		h.position.x = this.startPos.x + Math.min(0, dx);
		h.position.y = this.startPos.y;
		v.position.x = this.startPos.x;
		v.position.y = this.startPos.y + Math.min(0, dy);
		h.length = Math.abs(dx);
		v.length = Math.abs(dy);

		if (this._direction === WireDirection.HORIZONTAL) {
			v.position.x = this.startPos.x + dx;
		} else {
			h.position.y = this.startPos.y + dy;
		}
	}

	onEnd(): void {
		const wires = ([this._h, this._v] as const).filter(
			(w): w is Wire => w !== null && w.length > 0
		);
		if (wires.length > 0) {
			this.project.actionManager.push(new AddWiresAction(...wires));
		}
		this._cleanup();
	}

	canEnd(): boolean {
		return true;
	}

	onCancel(): void {
		this._cleanup();
	}

	private _cleanup(): void {
		this._h?.destroy({ children: true });
		this._v?.destroy({ children: true });
		this._h = null;
		this._v = null;
	}
}
