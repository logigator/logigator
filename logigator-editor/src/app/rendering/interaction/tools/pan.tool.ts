import { Project } from '../../../project/project';
import { PanSession } from '../../sessions/pan.session';
import { PointerInput } from '../pointer-input';
import { BoardTool, ToolHost } from './board-tool';

/** The hand tool: one-pointer pan; a tap single-selects (see PanSession). */
export class PanTool implements BoardTool {
  public down(project: Project, input: PointerInput, host: ToolHost): void {
    host.startSession(new PanSession(project, input.global, input.grid));
  }
}
