import { Action } from '../action';
import { Project } from '../../project/project';
import { PortSide } from '../../components/component';
import { SerializedAction } from '../serialized-action.model';
import { LoggingService } from '../../logging/logging.service';
import { getStaticDI } from '../../utils/get-di';

/**
 * Toggles negation on a single component port. `negated` is the post-`do`
 * state, so one undo step flips it either way (mirroring ChangeOptionAction's
 * old/new pairing). The component is resolved fresh each time so the action
 * survives undo across other edits.
 */
export class TogglePortNegationAction extends Action {
  private readonly logging = getStaticDI(LoggingService);

  constructor(
    private readonly componentId: number,
    private readonly side: PortSide,
    private readonly index: number,
    private readonly negated: boolean
  ) {
    super();
  }

  serialize(): SerializedAction {
    return {
      type: 'togglePortNegation',
      componentId: this.componentId,
      side: this.side,
      index: this.index,
      negated: this.negated
    };
  }

  do(project: Project): void {
    this._set(project, this.negated);
  }

  undo(project: Project): void {
    this._set(project, !this.negated);
  }

  private _set(project: Project, negated: boolean): void {
    const component = project.getComponentById(this.componentId);
    if (!component) {
      this.logging.warn(
        `no-op: component ${this.componentId} missing`,
        'TogglePortNegationAction'
      );
      return;
    }
    component.setPortNegated(this.side, this.index, negated);
  }
}
