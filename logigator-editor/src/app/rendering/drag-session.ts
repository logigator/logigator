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
   * Optional: true while the session floats without a locked drag anchor —
   * opened by a discrete rotate/move command and not yet grabbed. The router
   * auto-commits such a session the instant a rotate/moveBy leaves it
   * collision-free, mirroring the first-op commit in _startSelectionRotate.
   * Sessions that must always be placed by hand (paste) omit it so they never
   * self-commit; a session grabbed by the pointer reports false so a mid-drag
   * turn does not commit under the cursor.
   */
  isAwaitingGrab?(): boolean;
  /**
   * Optional: turn the session's floating elements by `steps` clockwise
   * quarter-turns around their own snapped centre (the rotate-selection
   * shortcut fired mid-session). Sessions without turnable content omit it;
   * the router drops the request then.
   */
  rotate?(steps: number): void;
  /**
   * Optional: shift the session's floating elements by (dx, dy) grid units
   * (a move-selection shortcut fired mid-session). Same omission convention
   * as {@link rotate}.
   */
  moveBy?(dx: number, dy: number): void;
}
