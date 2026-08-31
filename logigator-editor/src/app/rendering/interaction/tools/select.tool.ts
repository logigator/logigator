import { Project } from '../../../project/project';
import { WorkMode } from '../../../work-mode/work-mode.enum';
import { ShortcutService } from '../../../shortcuts/shortcut.service';
import { ShortcutActionEnum } from '../../../shortcuts/shortcut-action.enum';
import { getStaticDI } from '../../../utils/get-di';
import { roundToGrid } from '../../../utils/grid';
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

  public down(project: Project, input: PointerInput, host: ToolHost): void {
    const localPoint = input.grid;
    // Where a persistent grab rect exists it is the drag target, so the gaps
    // inside it are grabbable; rect-less selections fall back to bounds.
    if (project.selectionManager.isGrabbedAt(localPoint)) {
      host.startSession(
        new SelectionMoveSession(
          project,
          project.floatingLayer.dragLayer,
          project.selectionManager.selectedComponents,
          project.selectionManager.selectedWires,
          roundToGrid(localPoint, true)
        )
      );
    } else {
      host.startSession(
        new SelectRectSession(
          project,
          project.floatingLayer,
          localPoint,
          this.mode,
          this._scissorKey
        )
      );
    }
  }
}
