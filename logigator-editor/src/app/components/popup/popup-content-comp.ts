// @ts-strict-ignore
import { EventEmitter, Input, Output, Directive } from '@angular/core';

@Directive()
export abstract class PopupContentComp<In = unknown, Out = unknown> {
	@Output()
	requestClose: EventEmitter<Out> = new EventEmitter<Out>();

	@Input()
	inputFromOpener: In;
}
