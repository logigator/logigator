import { Project } from '../../../project/project';
import { EditorSettingsService } from '../../../settings/editor-settings.service';
import { getStaticDI } from '../../../utils/get-di';
import { PanSession } from '../../sessions/pan.session';
import { SelectionMoveSession } from '../../sessions/selection-move.session';
import { PointerInput } from '../pointer-input';
import { BoardTool, ToolHost } from './board-tool';

/**
 * The hand tool: one-pointer pan; a tap single-selects (see PanSession).
 *
 * With `dragSelectionInPanMode` on, a press that grabs the committed
 * selection drags it instead of panning.
 */
export class PanTool implements BoardTool {
  private readonly _settings = getStaticDI(EditorSettingsService);

  public down(project: Project, input: PointerInput, host: ToolHost): void {
    if (
      this._settings.dragSelectionInPanMode.value() &&
      project.selectionManager.isGrabbedAt(input.grid)
    ) {
      host.startSession(SelectionMoveSession.forSelection(project, input.grid));
      return;
    }
    host.startSession(new PanSession(project, input.global, input.grid));
  }
}
