import { Project } from '../../../project/project';
import { PanSession } from '../../sessions/pan.session';
import { PointerInput } from '../pointer-input';
import { BoardTool, ToolHost } from './board-tool';

/** The hand tool: a drag pans the board, and that is all it does. */
export class PanTool implements BoardTool {
  public down(project: Project, input: PointerInput, host: ToolHost): void {
    host.startSession(
      new PanSession(project, input.global, input.grid, () => undefined)
    );
  }
}
