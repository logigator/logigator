import { Action } from '../action';
import { Project } from '../../project/project';
import { SerializedAction } from '../serialized-action.model';
import { LoggingService } from '../../logging/logging.service';
import { getStaticDI } from '../../utils/get-di';

export class ChangeOptionAction<T = unknown> extends Action {
  private readonly logging = getStaticDI(LoggingService);

  constructor(
    private readonly componentId: number,
    private readonly optionKey: string,
    private readonly oldValue: T,
    private readonly newValue: T
  ) {
    super();
  }

  serialize(): SerializedAction {
    return {
      type: 'changeOption',
      componentId: this.componentId,
      optionKey: this.optionKey,
      oldValue: this.oldValue,
      newValue: this.newValue
    };
  }

  do(project: Project): void {
    this._set(project, this.newValue);
  }

  undo(project: Project): void {
    this._set(project, this.oldValue);
  }

  private _set(project: Project, value: T): void {
    const option = project.getComponentById(this.componentId)?.options[
      this.optionKey
    ];
    if (!option) {
      this.logging.warn(
        `no-op: component ${this.componentId} or option ${this.optionKey} missing`,
        'ChangeOptionAction'
      );
      return;
    }
    option.value = value;
    // A port-count change repaints through portsChange$, but a visual-only
    // option touches no ports, so ask for the frame here.
    project.triggerTicker('single');
  }
}
