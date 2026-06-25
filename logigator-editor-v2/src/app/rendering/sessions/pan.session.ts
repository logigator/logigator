import { FederatedPointerEvent, Point, Rectangle } from 'pixi.js';
import { DragSession } from '../drag-session';
import { Project } from '../../project/project';
import { WorkMode } from '../../work-mode/work-mode.enum';

/** Screen-space movement (px) beyond which a press counts as a pan, not a tap. */
const CLICK_MOVE_THRESHOLD = 5;

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
 *
 * A press that never moves past a small threshold is treated as a click/tap.
 * By default it single-selects the element under it (clearing on empty space),
 * reusing SELECT mode's click path — so PAN stays navigate-first but a tap still
 * selects. The board does not move until the threshold is crossed, so a tap
 * never nudges it. Passing `onTap` overrides the tap action (simulation mode
 * uses it to activate a button/lever instead of selecting), keeping the same
 * drag-to-pan navigation.
 */
export class PanSession implements DragSession {
  private readonly _lastGlobal: Point;
  private readonly _startGlobal: Point;
  private readonly _clickPoint: Point;
  private _moved = false;

  constructor(
    private readonly project: Project,
    startGlobal: Point,
    clickPoint: Point,
    private readonly onTap?: (clickPoint: Point) => void
  ) {
    this._lastGlobal = startGlobal.clone();
    this._startGlobal = startGlobal.clone();
    this._clickPoint = clickPoint.clone();
  }

  onMove(e: FederatedPointerEvent): void {
    const g = e.global;
    if (!this._moved) {
      const dx = g.x - this._startGlobal.x;
      const dy = g.y - this._startGlobal.y;
      if (dx * dx + dy * dy <= CLICK_MOVE_THRESHOLD * CLICK_MOVE_THRESHOLD) {
        return; // still within tap tolerance — don't pan yet
      }
      this._moved = true;
    }
    this.project.pan(
      new Point(g.x - this._lastGlobal.x, g.y - this._lastGlobal.y)
    );
    this._lastGlobal.copyFrom(g);
  }

  onEnd(): void {
    if (this._moved) return; // it was a pan; leave the tap action untouched
    if (this.onTap) {
      this.onTap(this._clickPoint);
      return;
    }
    this.project.selectionManager.commit(
      new Rectangle(this._clickPoint.x, this._clickPoint.y, 0, 0),
      WorkMode.SELECT
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onCancel(): void {}

  canEnd(): boolean {
    return true;
  }
}
