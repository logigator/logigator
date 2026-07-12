import { Type } from '@angular/core';
import { ComponentAction } from '../../component-action';
import { ShareComponentActionComponent } from './share-component-action.component';

/** Inspector action: manage a cloud custom component's share link and visibility. */
export class ShareComponentAction extends ComponentAction {
  public readonly renderer: Type<unknown> = ShareComponentActionComponent;
}
