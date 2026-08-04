import { Type } from '@angular/core';
import { ComponentAction } from '../../component-action';
import { DeleteComponentActionComponent } from './delete-component-action.component';

/** Inspector action: delete a custom component from the library. */
export class DeleteComponentAction extends ComponentAction {
  public readonly renderer: Type<unknown> = DeleteComponentActionComponent;
}
