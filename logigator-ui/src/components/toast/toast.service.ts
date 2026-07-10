import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { LgSeverity } from '../../tokens/severity';

/** A toast notification handed to {@link ToastService.add}. */
export interface ToastMessage {
  /** Severity → themed colour and icon; an omitted severity renders as `info`. */
  severity?: LgSeverity;
  summary?: string;
  detail?: string;
  /** Auto-dismiss delay in ms. */
  life?: number;
}

/**
 * Pushes toast notifications imperatively. `add()` emits onto
 * {@link messageObserver}, which the `<lg-toast>` outlet renders. `root`-provided,
 * so no provider wiring is needed at call sites.
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
