import {Directive, Input} from '@angular/core';
import {ComponentInspectable} from '../../models/rendering/graphics/l-graphics';

@Directive()
export abstract class ElementInspectionComp {

	@Input()
	sprite: ComponentInspectable;

}
