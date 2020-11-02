import { EventEmitter, Input, Output, Directive } from '@angular/core';

@Directive()
export abstract class PopupContentComp<In = any, Out = any> {

	@Output()
	requestClose: EventEmitter<Out> = new EventEmitter<Out>();

	@Input()
	inputFromOpener: In;
}
