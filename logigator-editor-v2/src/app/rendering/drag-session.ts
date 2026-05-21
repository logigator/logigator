import { FederatedPointerEvent } from 'pixi.js';

export interface DragSession {
	onMove(e: FederatedPointerEvent): void;
	onEnd(): void;
	onCancel(): void;
}
