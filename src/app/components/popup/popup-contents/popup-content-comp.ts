import {EventEmitter, Output} from '@angular/core';

export abstract class PopupContentComp {

	@Output()
	requestClose: EventEmitter<any> = new EventEmitter<any>();

}
