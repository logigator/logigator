import { PointerInput } from './interaction/pointer-input';

export interface DragSession {
  onMove(input: PointerInput): void;
  onEnd(): void;
  onCancel(): void;
  // Return false to keep the session alive (collision block / silent discard).
  canEnd(): boolean;
}
