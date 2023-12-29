import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PopupContentComp } from '../../popup/popup-content-comp';

@Component({
	selector: 'app-unsaved-changes',
	templateUrl: './unsaved-changes.component.html',
	styleUrls: ['./unsaved-changes.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class UnsavedChangesComponent extends PopupContentComp {
	constructor() {
		super();
	}

	okClick() {
		this.requestClose.emit(true);
	}

	cancelClick() {
		this.requestClose.emit(false);
	}
}
