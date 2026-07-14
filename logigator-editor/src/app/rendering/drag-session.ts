import { PointerInput } from './interaction/pointer-input';

export interface DragSession {
  onMove(input: PointerInput): void;
  onEnd(): void;
  onCancel(): void;
  // Return false to keep the session alive (collision block / silent discard).
  canEnd(): boolean;
  /**
   * Optional: a new primary press while this session is already active (only
   * possible for sessions that outlive a gesture, e.g. paste placement).
   * Return true when the press was consumed; false asks the router to cancel
   * the session — the press is spent either way.
   */
  onDown?(input: PointerInput): boolean;
}
