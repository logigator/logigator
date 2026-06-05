import { FederatedPointerEvent } from 'pixi.js';

export interface DragSession {
  onMove(e: FederatedPointerEvent): void;
  onEnd(): void;
  onCancel(): void;
  // Return false to keep the session alive (collision block / silent discard).
  canEnd(): boolean;
}
