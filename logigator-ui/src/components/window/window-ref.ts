import { Observable, ReplaySubject, Subject } from 'rxjs';
import { WindowSize } from './window-config';

/**
 * Handle to an open floating window ({@link WindowService.open}). The shape
 * mirrors {@link DialogRef} — `close(result?)` settles `onClose` exactly once,
 * `onChildComponentLoaded` replays the instantiated content instance — plus
 * the window-specific bits: `focus()` raises the window in the stack, and
 * `resized` streams the window size after each user resize so canvas-hosting
 * content can re-render.
 */
export class WindowRef<R = unknown> {
  private readonly closeSubject = new Subject<R | undefined>();
  private readonly childLoadedSubject = new ReplaySubject<unknown>(1);
  private readonly resizedSubject = new Subject<WindowSize>();
  private settled = false;

  readonly onClose: Observable<R | undefined> =
    this.closeSubject.asObservable();
  readonly onChildComponentLoaded: Observable<unknown> =
    this.childLoadedSubject.asObservable();
  /** Emits the window's outer size after each user-driven resize. */
  readonly resized: Observable<WindowSize> = this.resizedSubject.asObservable();

  /**
   * @param disposer Removes the window from the open set; supplied by
   * {@link WindowService}. Runs once, before `onClose` emits.
   * @param focuser Brings the window to the front of the stack.
   */
  constructor(
    private readonly disposer: () => void = () => undefined,
    private readonly focuser: () => void = () => undefined
  ) {}

  /** Close the window, resolving {@link onClose} with `result`. Idempotent. */
  close(result?: R): void {
    if (this.settled) {
      return;
    }
    this.settled = true;
    this.disposer();
    this.closeSubject.next(result);
    this.closeSubject.complete();
    this.childLoadedSubject.complete();
    this.resizedSubject.complete();
  }

  /** Bring the window to the front of the window stack. */
  focus(): void {
    this.focuser();
  }

  /** @internal The window chrome reports the instantiated content here. */
  notifyChildLoaded(instance: unknown): void {
    this.childLoadedSubject.next(instance);
  }

  /** @internal The window chrome reports each applied resize here. */
  notifyResized(size: WindowSize): void {
    this.resizedSubject.next(size);
  }
}
