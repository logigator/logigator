import { Action } from './action';
import { Project } from '../project/project';
import { SerializedAction } from './serialized-action.model';
import { LoggingService } from '../logging/logging.service';
import { getStaticDI } from '../utils/get-di';

export class ActionContainer extends Action {
  private readonly actions: Action[];

  private readonly logging = getStaticDI(LoggingService);

  constructor(...actions: Action[]) {
    super();
    this.actions = actions;
  }

  public serialize(): SerializedAction {
    return {
      type: 'container',
      actions: this.actions.map((action) => action.serialize())
    };
  }

  public do(project: Project): void {
    this.logging.debug(
      `do ${this.actions.length} grouped action(s)`,
      'ActionContainer'
    );
    for (const action of this.actions) {
      action.do(project);
    }
  }

  public undo(project: Project): void {
    for (let i = this.actions.length - 1; i >= 0; i--) {
      this.actions[i].undo(project);
    }
  }

  public add(action: Action): void {
    this.actions.push(action);
  }

  public get length(): number {
    return this.actions.length;
  }
}
