import { FederatedPointerEvent, Point } from 'pixi.js';
import { DragSession } from '../drag-session';
import { Project } from '../../project/project';

export class WireConnectionSession implements DragSession {
	constructor(
		private readonly project: Project,
		private readonly startPos: Point
	) {}

	onMove(_e: FederatedPointerEvent): void {}

	onEnd(): void {
		this.project.toggleConnectionAt(this.startPos);
	}

	onCancel(): void {}

	canEnd(): boolean {
		return true;
	}
}
