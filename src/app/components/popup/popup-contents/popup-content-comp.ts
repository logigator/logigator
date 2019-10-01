import {EventEmitter, Input, Output} from '@angular/core';

export abstract class PopupContentComp<T = any> {

	@Output()
	requestClose: EventEmitter<any> = new EventEmitter<any>();

	@Input()
	inputFromOpener: T;

}
