import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/**
 * Toast severity. `danger` is accepted for call-site parity (the editor passes
 * it) but is **not** a themed colour — {@link LgToast} normalizes it to `error`.
 */
export type LgToastSeverity = 'success' | 'info' | 'warn' | 'error' | 'danger';

/** A toast notification handed to {@link MessageService.add}. */
export interface ToastMessage {
  severity?: LgToastSeverity;
  summary?: string;
  detail?: string;
  /** Auto-dismiss delay in ms. */
  life?: number;
}

/**
 * Pushes toast notifications imperatively — the in-house replacement for
 * PrimeNG's `MessageService`. `add()` emits onto {@link messageObserver}, which
 * the `<lg-toast>` outlet renders. `root`-provided, so no provider wiring is
 * needed at call sites.
 */
@Injectable({ providedIn: 'root' })
export class MessageService {
  private readonly messages = new Subject<ToastMessage>();
  readonly messageObserver: Observable<ToastMessage> =
    this.messages.asObservable();

  add(message: ToastMessage): void {
    this.messages.next(message);
  }
}
