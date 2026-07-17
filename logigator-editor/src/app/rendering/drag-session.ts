import { PointerInput } from './interaction/pointer-input';

export interface DragSession {
  onMove(input: PointerInput): void;
  onEnd(): void;
  onCancel(): void;
  // Return false to keep the session alive (collision block / silent discard).
  canEnd(): boolean;
  /**
   * Optional: when a release lands while `canEnd()` is false, discard the
   * session (as if cancelled) instead of freezing it in place. Placement
   * sessions set this so an invalid drop just clears the ghost, ready for the
   * next placement; move/paste sessions leave it unset so they stay put.
   */
  readonly discardOnInvalidRelease?: boolean;
  /**
   * Optional: a new primary press while this session is already active (only
   * possible for sessions that outlive a gesture, e.g. paste placement).
   * Return true when the press was consumed; false asks the router to cancel
   * the session — the press is spent either way.
   */
  onDown?(input: PointerInput): boolean;
  /**
   * Optional: turn the session's floating elements by `steps` clockwise
   * quarter-turns around their own snapped centre (the rotate-selection
   * shortcut fired mid-session). Sessions without turnable content omit it;
   * the router drops the request then.
   */
  rotate?(steps: number): void;
}
