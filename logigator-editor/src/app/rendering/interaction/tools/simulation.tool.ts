import { Point } from 'pixi.js';
import { Project } from '../../../project/project';
import { BuiltInComponentType } from '@logigator/core';
import { HoldSession } from '../../sessions/hold.session';
import { PanSession } from '../../sessions/pan.session';
import { buttonAt, componentBodiesAt } from '../body-hit';
import { PointerInput } from '../pointer-input';
import { BoardTool, ToolHost } from './board-tool';

/**
 * Editing stays structurally locked, but a drag pans like the hand tool and a
 * tap activates the component under the cursor — the only canvas interaction
 * allowed while the lock holds. A press on a button holds it for the gesture
 * instead, and never pans.
 */
export class SimulationTool implements BoardTool {
  public down(project: Project, input: PointerInput, host: ToolHost): void {
    const button = buttonAt(project, input.grid);
    if (button) {
      host.startSession(
        new HoldSession(
          () => project.emitUserInput(button, 'press'),
          () => project.emitUserInput(button, 'release')
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
   * Activates the component whose body contains the point: a pulse
   * button/switch emits user input, an inspectable component an inspect
   * request.
   */
  private _emitUserInputAt(project: Project, localPoint: Point): void {
    for (const comp of componentBodiesAt(project, localPoint)) {
      const type = comp.config.type;
      if (
        type === BuiltInComponentType.PULSE_BUTTON ||
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
