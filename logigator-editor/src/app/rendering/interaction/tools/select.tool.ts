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
 * The select tool: a press inside the committed selection's grab zone starts
 * a move; anywhere else it draws a new marquee. One instance per marquee
 * flavor — SELECT and SELECT_EXACT register their own, so the session gets
 * the right base mode while the hold-to-scissor key stays live in both.
 */
export class SelectTool implements BoardTool {
  private readonly _shortcuts = getStaticDI(ShortcutService);
  private readonly _scissorKey: ScissorKeyState = {
    isHeld: () => this._shortcuts.isHeld(ShortcutActionEnum.SELECT_SCISSOR),
    change$: this._shortcuts.heldChange$
  };

  constructor(
    private readonly mode: WorkMode.SELECT | WorkMode.SELECT_EXACT
  ) {}

  public down(project: Project, input: PointerInput, host: ToolHost): void {
    const localPoint = input.grid;
    // The persistent grab rect (the marquee as drawn) is the drag target
    // where one exists, so the gaps inside it are grabbable too; rect-less
    // selections (single click) fall back to element bounds.
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
