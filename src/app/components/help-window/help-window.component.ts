import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';

@Component({
	selector: 'app-help-window',
	templateUrl: './help-window.component.html',
	styleUrls: ['./help-window.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpWindowComponent {

	@Input()
	public helpToDisplay: string;

	@Output()
	requestClose: EventEmitter<boolean> = new EventEmitter<boolean>();

	public dontShowAgain: boolean;

	constructor() { }

	public okClick() {
		this.requestClose.emit(this.dontShowAgain);
	}

}
