import { PointerInput } from './interaction/pointer-input';

export interface DragSession {
  onMove(input: PointerInput): void;
  onEnd(): void;
  onCancel(): void;
  // False keeps the session alive (collision block / silent discard).
  canEnd(): boolean;
  /**
   * Discard the session on a release while `canEnd()` is false, instead of
   * freezing it in place. Placement sessions set this; move/paste do not.
   */
  readonly discardOnInvalidRelease?: boolean;
  /**
   * The release that froze this session in place. The gesture is over even
   * though the session is not, so a session holding a drag anchor drops it
   * here and the next press grabs the group where it lands.
   */
  onInvalidRelease?(): void;
  /**
   * A new primary press while this session is active, possible only for
   * sessions that outlive a gesture. True consumes the press; false asks the
   * router to cancel the session. The press is spent either way.
   */
  onDown?(input: PointerInput): boolean;
  /**
   * True while the session floats without a locked drag anchor. The router
   * auto-commits such a session the instant a rotate/moveBy leaves it
   * collision-free. Sessions that must be placed by hand omit it; a session
   * grabbed by the pointer reports false, so a mid-drag turn does not commit
   * under the cursor.
   */
  isAwaitingGrab?(): boolean;
  /**
   * Turns the floating elements by `steps` clockwise quarter-turns around
   * their own snapped centre. Sessions without turnable content omit it and
   * the router drops the request.
   */
  rotate?(steps: number): void;
  /** Shifts the floating elements by (dx, dy) grid units. */
  moveBy?(dx: number, dy: number): void;
}
