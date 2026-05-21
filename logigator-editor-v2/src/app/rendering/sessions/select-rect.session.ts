import { Container, FederatedPointerEvent, Graphics, Point, Rectangle } from 'pixi.js';

import { DragSession } from '../drag-session';
import { Project } from '../../project/project';
import { WorkMode } from '../../work-mode/work-mode.enum';

export class SelectRectSession implements DragSession {
	private readonly selectRect: Graphics;

	constructor(
		private readonly project: Project,
		private readonly parent: Container,
		private readonly startPos: Point,
		private readonly mode: WorkMode
	) {
		this.selectRect = new Graphics();
		this.selectRect.rect(0, 0, 1, 1);
		this.selectRect.alpha = 0.3;
		this.selectRect.fill(0x0);
		this.selectRect.position.copyFrom(startPos);
		this.selectRect.scale.set(0, 0);
		parent.addChild(this.selectRect);
	}

	onMove(e: FederatedPointerEvent): void {
		const current = e.getLocalPosition(this.project.gridSpace);
		this.selectRect.scale.set(
			current.x - this.startPos.x,
			current.y - this.startPos.y
		);
	}

	onEnd(): void {
		const rect = this._normalizeRect();
		this.selectRect.destroy();
		this.project.selectionManager.commit(rect, this.mode);
	}

	onCancel(): void {
		this.selectRect.destroy();
	}

	private _normalizeRect(): Rectangle {
		const sx = this.selectRect.scale.x;
		const sy = this.selectRect.scale.y;
		return new Rectangle(
			sx >= 0 ? this.startPos.x : this.startPos.x + sx,
			sy >= 0 ? this.startPos.y : this.startPos.y + sy,
			Math.abs(sx),
			Math.abs(sy)
		);
	}
}
