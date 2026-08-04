import { Type } from '@angular/core';
import { ComponentAction } from '../../component-action';
import { EditDetailsActionComponent } from './edit-details-action.component';

/** Inspector action: edit a master's descriptive metadata (name/symbol/description). */
export class EditDetailsAction extends ComponentAction {
  public readonly renderer: Type<unknown> = EditDetailsActionComponent;
}
