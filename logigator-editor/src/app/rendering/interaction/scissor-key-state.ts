import { Observable } from 'rxjs';

/**
 * Live state of the hold-to-scissor key: a poll plus a change notification, so
 * a press under a motionless pointer restyles the marquee immediately.
 */
export interface ScissorKeyState {
  isHeld(): boolean;
  change$: Observable<void>;
}
