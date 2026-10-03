import { DragSession } from '../drag-session';

/**
 * Holds a level-driven user input (a button) for the length of one gesture,
 * shared by the board and the sub-circuit watch. The hold starts pressed —
 * construction runs `press` — and `release` runs exactly once, whichever way
 * the gesture ends: release, cancel, or the window losing focus or going
 * hidden, which leaves no pointer-up to wait for. Movement does nothing, so
 * the press never pans and stays held wherever the pointer goes.
 */
export class HoldSession implements DragSession {
  private readonly _abort = new AbortController();
  private _held = true;

  constructor(
    press: () => void,
    private readonly release: () => void
  ) {
    press();
    const signal = this._abort.signal;
    window.addEventListener('blur', () => this._release(), { signal });
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState === 'hidden') this._release();
      },
      { signal }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onMove(): void {}

  onEnd(): void {
    this._release();
  }

  onCancel(): void {
    this._release();
  }

  canEnd(): boolean {
    return true;
  }

  private _release(): void {
    if (!this._held) return;
    this._held = false;
    this._abort.abort();
    this.release();
  }
}
