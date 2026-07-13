import { Observable } from 'rxjs';

/**
 * Live state of the hold-to-scissor key (ShortcutActionEnum.SELECT_SCISSOR),
 * as the select marquee consumes it: a poll plus a change notification, so a
 * key press under a motionless pointer restyles the marquee immediately. The
 * WorkModeRouter adapts ShortcutService (`isHeld` / `heldChange$`) to this.
 */
export interface ScissorKeyState {
  isHeld(): boolean;
  change$: Observable<void>;
}
