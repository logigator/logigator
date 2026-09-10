import { Type } from '@angular/core';
import { ComponentAction } from '../../component-action';
import { UpdateInstanceActionComponent } from './update-instance-action.component';

/** Inspector action: bring one instance up to its master's version. */
export class UpdateInstanceComponentAction extends ComponentAction {
  public readonly renderer: Type<unknown> = UpdateInstanceActionComponent;
}
