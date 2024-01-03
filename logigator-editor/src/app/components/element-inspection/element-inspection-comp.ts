// @ts-strict-ignore
import { Directive, Input } from '@angular/core';

@Directive()
export abstract class ElementInspectionComp {
	@Input()
	sprite: unknown;
}
