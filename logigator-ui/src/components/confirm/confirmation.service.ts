import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Confirmation } from './confirmation';

/**
 * Requests confirmations imperatively: `confirm()` pushes onto
 * {@link requireConfirmation$}, and the outlets render the one matching their
 * own `key`.
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
