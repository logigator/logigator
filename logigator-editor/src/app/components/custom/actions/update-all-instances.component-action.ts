import { Type } from '@angular/core';
import { ComponentAction } from '../../component-action';
import { UpdateAllInstancesActionComponent } from './update-all-instances-action.component';

/**
 * Inspector action: bring every outdated instance of this custom type in the
 * active project up to its master's latest version, in one undo entry.
 */
export class UpdateAllInstancesComponentAction extends ComponentAction {
  public readonly renderer: Type<unknown> = UpdateAllInstancesActionComponent;
}
