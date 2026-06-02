import { Type } from '@angular/core';
import { ComponentAction } from '../../component-action';
import { UpdateInstanceActionComponent } from './update-instance-action.component';

/** Inspector action: bring a selected custom instance up to its master's latest version. */
export class UpdateInstanceComponentAction extends ComponentAction {
	public readonly renderer: Type<unknown> = UpdateInstanceActionComponent;
}
