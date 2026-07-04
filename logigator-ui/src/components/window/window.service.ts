import { Injectable, signal, Type, WritableSignal } from '@angular/core';
import { WindowConfig } from './window-config';
import { WindowRef } from './window-ref';

/** One open window, as rendered by {@link LgWindowOutlet}. */
export interface OpenWindow {
  readonly id: number;
  readonly component: Type<unknown>;
  readonly config: WindowConfig;
  readonly ref: WindowRef<unknown>;
  /** Stacking order; raising a window bumps it past every other window. */
  readonly zIndex: WritableSignal<number>;
  /** Open-order index driving the default cascade position. */
  readonly cascade: number;
}

/**
 * Opens components in floating, draggable, resizable windows — non-modal
 * panels stacked over the app's own content rather than a `cdk/overlay`. The
 * windows render inside the {@link LgWindowOutlet} the host app places (the
 * outlet's element is also the drag/resize bounds), so without an outlet in
 * the tree nothing shows. Any number of windows can be open at once; focusing
 * one (or pressing it) raises it above the rest. There is no backdrop and no
 * focus trap — the content behind the windows stays interactive.
 */
@Injectable({ providedIn: 'root' })
export class WindowService {
  private readonly openWindows = signal<readonly OpenWindow[]>([]);
  /** The open windows, in opening order; the outlet renders these. */
  readonly windows = this.openWindows.asReadonly();

  private nextId = 0;
  private zCounter = 0;
  private cascadeCounter = 0;

  open<C, R = unknown>(
    component: Type<C>,
    config: WindowConfig = {}
  ): WindowRef<R> {
    const id = ++this.nextId;
    const ref = new WindowRef<R>(
      () => this.remove(id),
      () => this.bringToFront(id)
    );
    const entry: OpenWindow = {
      id,
      component,
      config,
      ref: ref as WindowRef<unknown>,
      zIndex: signal(++this.zCounter),
      cascade: this.cascadeCounter++
    };
    this.openWindows.update((windows) => [...windows, entry]);
    return ref;
  }

  /** Close every open window (each ref's `onClose` still resolves). */
  closeAll(): void {
    for (const window of [...this.openWindows()]) {
      window.ref.close();
    }
  }

  private bringToFront(id: number): void {
    this.openWindows()
      .find((window) => window.id === id)
      ?.zIndex.set(++this.zCounter);
  }

  private remove(id: number): void {
    this.openWindows.update((windows) =>
      windows.filter((window) => window.id !== id)
    );
    // With the workspace clear, the next window starts the cascade over.
    if (this.openWindows().length === 0) {
      this.cascadeCounter = 0;
    }
  }
}
