import { Point } from 'pixi.js';
import { Project } from '../../../project/project';
import { isUserInput } from '../../../components/user-input';
import { HoldSession } from '../../sessions/hold.session';
import { PanSession } from '../../sessions/pan.session';
import { componentBodiesAt, holdInputAt } from '../body-hit';
import { PointerInput } from '../pointer-input';
import { BoardTool, ToolHost } from './board-tool';

/**
 * Editing stays structurally locked, but a drag pans like the hand tool and a
 * tap activates the component under the cursor — the only canvas interaction
 * allowed while the lock holds. A press on a `hold` user input operated on
 * the canvas holds its slot 0 for the gesture instead, and never pans.
 */
export class SimulationTool implements BoardTool {
  public down(project: Project, input: PointerInput, host: ToolHost): void {
    const holdInput = holdInputAt(project, input.grid);
    if (holdInput) {
      host.startSession(
        new HoldSession(
          () => project.emitUserInput(holdInput, 'press', 0),
          () => project.emitUserInput(holdInput, 'release', 0)
        )
      );
      return;
    }
    host.startSession(
      new PanSession(project, input.global, input.grid, (clickPoint) =>
        this._emitUserInputAt(project, clickPoint)
      )
    );
  }

  /**
   * Activates the component whose body contains the point: an inspectable
   * component emits an inspect request, a `toggle` or `pulse` user input a
   * tap on its slot 0.
   */
  private _emitUserInputAt(project: Project, localPoint: Point): void {
    for (const comp of componentBodiesAt(project, localPoint)) {
      if (
        isUserInput(comp) &&
        comp.gesture !== 'hold' &&
        !comp.config.inspection
      ) {
        project.emitUserInput(comp, 'tap', 0);
        break;
      }
      if (comp.config.inspection) {
        project.emitInspectRequest(comp);
        break;
      }
    }
  }
}
