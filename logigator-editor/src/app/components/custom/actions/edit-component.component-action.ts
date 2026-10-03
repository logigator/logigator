import { Type } from '@angular/core';
import { ComponentAction } from '../../component-action';
import { EditComponentActionComponent } from './edit-component-action.component';

/** Inspector action: edit the master behind a custom instance. */
export class EditComponentAction extends ComponentAction {
  public readonly renderer: Type<unknown> = EditComponentActionComponent;
}
