import { Type } from '@angular/core';
import { ComponentAction } from '../../component-action';
import { EditComponentActionComponent } from './edit-component-action.component';

/** Inspector action: open the master behind a selected custom instance for editing. */
export class EditComponentAction extends ComponentAction {
	public readonly renderer: Type<unknown> = EditComponentActionComponent;
}
