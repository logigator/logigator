import { Observable, ReplaySubject, Subject } from 'rxjs';

/**
 * Handle to an open dialog ({@link DialogService.open}). Mirrors the slice of
 * PrimeNG's `DynamicDialogRef` the editor uses:
 *
 * - `close(result?)` — close the dialog, resolving `onClose` with `result`.
 * - `onClose` — emits the close result (or `undefined` when dismissed) **once**,
 *   then completes, so `firstValueFrom(ref.onClose)` resolves on every teardown
 *   path (explicit close, Escape, backdrop, navigation).
 * - `onChildComponentLoaded` — emits the instantiated child component instance
 *   after its inputs are applied. A `ReplaySubject(1)` so a late subscriber
 *   still receives the instance.
 */
export class DialogRef<R = unknown> {
  private readonly closeSubject = new Subject<R | undefined>();
  private readonly childLoadedSubject = new ReplaySubject<unknown>(1);
  private settled = false;

  readonly onClose: Observable<R | undefined> =
    this.closeSubject.asObservable();
  readonly onChildComponentLoaded: Observable<unknown> =
    this.childLoadedSubject.asObservable();

  /**
   * @param disposer Overlay teardown + focus restore, supplied by
   * {@link DialogService}. Runs once, before `onClose` emits.
   */
  constructor(private readonly disposer: () => void = () => undefined) {}

  /** Close the dialog, resolving {@link onClose} with `result`. Idempotent. */
  close(result?: R): void {
    if (this.settled) {
      return;
    }
    this.settled = true;
    this.disposer();
    this.closeSubject.next(result);
    this.closeSubject.complete();
    this.childLoadedSubject.complete();
  }

  /** @internal The container reports the instantiated child component here. */
  notifyChildLoaded(instance: unknown): void {
    this.childLoadedSubject.next(instance);
  }
}
