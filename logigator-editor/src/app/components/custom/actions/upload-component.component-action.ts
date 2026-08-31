import { Type } from '@angular/core';
import { ComponentAction } from '../../component-action';
import { UploadComponentActionComponent } from './upload-component-action.component';

/** Inspector action: move a local component to the cloud library. */
export class UploadComponentAction extends ComponentAction {
  public readonly renderer: Type<unknown> = UploadComponentActionComponent;
}
