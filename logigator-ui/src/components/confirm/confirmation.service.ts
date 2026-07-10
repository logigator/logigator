import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Confirmation } from './confirmation';

/**
 * Requests confirmations imperatively. `confirm()` pushes the request onto
 * {@link requireConfirmation$}; the outlets (`<lg-confirm-dialog>`,
 * `<lg-confirm-popup>`) subscribe and render the one matching their `key`.
 * `root`-provided, so no provider wiring is needed at call sites.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmationService {
  private readonly requests = new Subject<Confirmation>();
  readonly requireConfirmation$: Observable<Confirmation> =
    this.requests.asObservable();

  confirm(confirmation: Confirmation): this {
    this.requests.next(confirmation);
    return this;
  }
}
