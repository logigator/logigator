import { Point } from 'pixi.js';
import { Project } from '../../../project/project';
import { WorkMode } from '../../../work-mode/work-mode.enum';
import { ShortcutService } from '../../../shortcuts/shortcut.service';
import { ShortcutActionEnum } from '../../../shortcuts/shortcut-action.enum';
import { getStaticDI } from '../../../utils/get-di';
import { SelectRectSession } from '../../sessions/select-rect.session';
import { SelectionMoveSession } from '../../sessions/selection-move.session';
import { PointerInput } from '../pointer-input';
import { ScissorKeyState } from '../scissor-key-state';
import { BoardTool, ToolHost } from './board-tool';

/**
 * A press inside the committed selection's grab zone starts a move; anywhere
 * else it draws a new marquee. SELECT and SELECT_EXACT register their own
 * instance, so the session gets the right base mode.
 */
export class SelectTool implements BoardTool {
  private readonly _shortcuts = getStaticDI(ShortcutService);
  private readonly _scissorKey: ScissorKeyState = {
    isHeld: () => this._shortcuts.isHeld(ShortcutActionEnum.SELECT_SCISSOR),
    change$: this._shortcuts.heldChange$
  };

  constructor(private readonly mode: WorkMode.SELECT | WorkMode.SELECT_EXACT) {}

  /**
   * What a press on the selection that never moved means: the click the tools'
   * taps make, so the modifier reads the same in every mode — narrow to the
   * element under the press, or toggle it with the modifier held.
   */
  private _tapAt(project: Project, pressPoint: Point): () => void {
    return () =>
      project.selectionManager.clickInSelection(
        pressPoint,
        this._shortcuts.isAdditiveHeld()
      );
  }

  public down(project: Project, input: PointerInput, host: ToolHost): void {
    const localPoint = input.grid;
    // Where a persistent grab rect exists it is the drag target, so the gaps
    // inside it are grabbable; rect-less selections fall back to bounds.
    if (project.selectionManager.isGrabbedAt(localPoint)) {
      // Cloned: opening the session snaps the grab point in place, and the
      // press point the tap fallback tests against has to stay where the
      // pointer was.
      const pressPoint = localPoint.clone();
      host.startSession(
        SelectionMoveSession.forSelection(
          project,
          localPoint,
          this._tapAt(project, pressPoint)
        )
      );
    } else {
      host.startSession(
        new SelectRectSession(
          project,
          project.floatingLayer,
          localPoint,
          this.mode,
          this._scissorKey,
          () => this._shortcuts.isAdditiveHeld()
        )
      );
    }
  }
}
