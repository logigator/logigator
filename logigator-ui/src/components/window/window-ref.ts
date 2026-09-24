import { Observable, ReplaySubject, Subject } from 'rxjs';
import { WindowRect, WindowSize } from './window-config';

/**
 * The window chrome's geometry hooks, in viewport CSS px. Registered by
 * {@link LgWindow} once it is in the DOM; absent before that (and for a
 * fullscreen outlet, where the window fills its host).
 * @internal
 */
export interface WindowGeometry {
  read(): WindowRect;
  /** `null` in a fullscreen outlet — there is no floating box to place. */
  write(rect: Partial<WindowRect>): WindowRect | null;
}

/**
 * Handle to an open floating window. The shape mirrors {@link DialogRef}, plus
 * the window-specific bits: `focus()` raises it in the stack, `resized`
 * streams the size after each user resize so canvas-hosting content can
 * re-render, and `bounds`/`setBounds` place it as a title-bar drag would.
 */
export class WindowRef<R = unknown> {
  private readonly closeSubject = new Subject<R | undefined>();
  private readonly childLoadedSubject = new ReplaySubject<unknown>(1);
  private readonly resizedSubject = new Subject<WindowSize>();
  private settled = false;
  private geometry: WindowGeometry | null = null;

  readonly onClose: Observable<R | undefined> =
    this.closeSubject.asObservable();
  readonly onChildComponentLoaded: Observable<unknown> =
    this.childLoadedSubject.asObservable();
  readonly resized: Observable<WindowSize> = this.resizedSubject.asObservable();

  /**
   * @param disposer Removes the window from the open set. Runs once, before
   * `onClose` emits.
   * @param focuser Brings the window to the front of the stack.
   */
  constructor(
    private readonly disposer: () => void = () => undefined,
    private readonly focuser: () => void = () => undefined
  ) {}

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

  focus(): void {
    this.focuser();
  }

  /** The outer box in viewport CSS px, `null` before the chrome is in the DOM. */
  get bounds(): WindowRect | null {
    return this.geometry?.read() ?? null;
  }

  /**
   * Moves and/or resizes the window in viewport CSS px, clamped to the outlet
   * as a title-bar drag is. Omitted fields keep their value. Returns the box
   * actually taken, or `null` when there is no geometry to write: before the
   * chrome is in the DOM, or in a fullscreen outlet.
   */
  setBounds(rect: Partial<WindowRect>): WindowRect | null {
    return this.geometry?.write(rect) ?? null;
  }

  /** @internal The window chrome registers its geometry hooks here. */
  attachGeometry(geometry: WindowGeometry | null): void {
    this.geometry = geometry;
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
