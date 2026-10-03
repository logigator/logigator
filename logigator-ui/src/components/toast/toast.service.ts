import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { LgSeverity } from '../../tokens/severity';

export interface ToastAction {
  label: string;
  /** Runs on click; the toast dismisses itself afterwards. */
  handler: () => void;
}

export interface ToastMessage {
  /** Picks the colour and icon; omitted renders as `info`. */
  severity?: LgSeverity;
  summary?: string;
  detail?: string;
  life?: number;
  /**
   * Turns the toast into an offer: a button below the message runs `handler`
   * and dismisses. Pair with `life: 0`, since an offer that expires before it
   * is read is worse than one the user closes.
   */
  action?: ToastAction;
}

/**
 * Pushes toast notifications imperatively: `add()` emits onto
 * {@link messageObserver}, which the `<lg-toast>` outlet renders.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly messages = new Subject<ToastMessage>();
  readonly messageObserver: Observable<ToastMessage> =
    this.messages.asObservable();

  add(message: ToastMessage): void {
    this.messages.next(message);
  }
}
