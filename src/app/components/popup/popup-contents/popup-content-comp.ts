import {EventEmitter, Output} from '@angular/core';

export abstract class PopupContentComp {

	@Output()
	requestClose: EventEmitter<void> = new EventEmitter<void>();

}
