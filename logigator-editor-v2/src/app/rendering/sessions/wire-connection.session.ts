import { Point } from 'pixi.js';
import { DragSession } from '../drag-session';
import { Project } from '../../project/project';

export class WireConnectionSession implements DragSession {
	constructor(
		private readonly project: Project,
		private readonly startPos: Point
	) {}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	onMove(): void {}

	onEnd(): void {
		this.project.toggleConnectionAt(this.startPos);
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	onCancel(): void {}

	canEnd(): boolean {
		return true;
	}
}
