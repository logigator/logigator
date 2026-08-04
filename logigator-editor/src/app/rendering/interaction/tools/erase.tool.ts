import { Project } from '../../../project/project';
import { EraseSession } from '../../sessions/erase.session';
import { PointerInput } from '../pointer-input';
import { BoardTool, ToolHost } from './board-tool';

export class EraseTool implements BoardTool {
  public down(project: Project, input: PointerInput, host: ToolHost): void {
    host.startSession(new EraseSession(project, input.grid));
  }
}
