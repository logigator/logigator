import { Observable, ReplaySubject, Subject } from 'rxjs';

/**
 * Handle to an open dialog. `onClose` emits the result (or `undefined` when
 * dismissed) **once** and completes, so `firstValueFrom(ref.onClose)` resolves
 * on every teardown path. `onChildComponentLoaded` is a `ReplaySubject(1)`, so
 * a late subscriber still receives the child instance.
 */
export class DialogRef<R = unknown, Instance = unknown> {
  private readonly closeSubject = new Subject<R | undefined>();
  private readonly childLoadedSubject = new ReplaySubject<Instance>(1);
  private settled = false;

  readonly onClose: Observable<R | undefined> =
    this.closeSubject.asObservable();
  readonly onChildComponentLoaded: Observable<Instance> =
    this.childLoadedSubject.asObservable();

  /** @param disposer Overlay teardown and focus restore, before `onClose`. */
  constructor(private readonly disposer: () => void = () => undefined) {}

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
  notifyChildLoaded(instance: Instance): void {
    this.childLoadedSubject.next(instance);
  }
}
