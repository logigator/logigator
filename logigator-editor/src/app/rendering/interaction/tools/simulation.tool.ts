import { Point, Rectangle } from 'pixi.js';
import { Project } from '../../../project/project';
import { BuiltInComponentType } from '@logigator/core';
import { PanSession } from '../../sessions/pan.session';
import { PointerInput } from '../pointer-input';
import { BoardTool, ToolHost } from './board-tool';

/**
 * Editing stays structurally locked, but a drag pans like the hand tool and a
 * tap activates the component under the cursor — the only canvas interaction
 * allowed while the lock holds.
 */
export class SimulationTool implements BoardTool {
  public down(project: Project, input: PointerInput, host: ToolHost): void {
    host.startSession(
      new PanSession(project, input.global, input.grid, (clickPoint) =>
        this._emitUserInputAt(project, clickPoint)
      )
    );
  }

  /**
   * Activates the component whose body contains the point: a button/switch
   * emits user input, an inspectable component an inspect request.
   */
  private _emitUserInputAt(project: Project, localPoint: Point): void {
    const queryRect = new Rectangle(
      localPoint.x - 0.5,
      localPoint.y - 0.5,
      1,
      1
    );
    for (const comp of project.queryComponentsInRange(queryRect)) {
      if (!comp.bodyGridBounds.contains(localPoint.x, localPoint.y)) {
        continue;
      }
      const type = comp.config.type;
      if (
        type === BuiltInComponentType.BUTTON ||
        type === BuiltInComponentType.SWITCH
      ) {
        project.emitUserInput(comp);
        break;
      }
      if (comp.config.inspection) {
        project.emitInspectRequest(comp);
        break;
      }
    }
  }
}
