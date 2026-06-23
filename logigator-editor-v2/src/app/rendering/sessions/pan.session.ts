import { FederatedPointerEvent, Point } from 'pixi.js';
import { DragSession } from '../drag-session';
import { Project } from '../../project/project';

/**
 * One-pointer pan (the hand tool / WorkMode.PAN). Shared by mouse and touch.
 *
 * Pans by the screen-space delta between successive pointer positions. It must
 * compute that delta itself rather than read `e.movement`: movementX/Y is
 * unreliable (often 0) for `pointerType === 'touch'` on some browsers (notably
 * iOS Safari), and this is the one-finger touch pan path. The right-drag pan in
 * InteractionContainer gets away with `e.movement` only because it is
 * mouse-only.
 *
 * `e.global` is screen space, which is exactly what `Project.pan` expects (it
 * adds the delta to the stage position). Do not convert to grid space here.
 */
export class PanSession implements DragSession {
  private readonly _lastGlobal: Point;

  constructor(
    private readonly project: Project,
    startGlobal: Point
  ) {
    this._lastGlobal = startGlobal.clone();
  }

  onMove(e: FederatedPointerEvent): void {
    const g = e.global;
    this.project.pan(
      new Point(g.x - this._lastGlobal.x, g.y - this._lastGlobal.y)
    );
    this._lastGlobal.copyFrom(g);
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onEnd(): void {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onCancel(): void {}

  canEnd(): boolean {
    return true;
  }
}
