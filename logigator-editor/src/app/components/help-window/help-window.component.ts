import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';

@Component({
	selector: 'app-help-window',
	templateUrl: './help-window.component.html',
	styleUrls: ['./help-window.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpWindowComponent {

	@Input()
	public title: string;

	@Input()
	public text: string;

	@Input()
	public isLastStep: boolean;

	@Output()
	skip: EventEmitter<void> = new EventEmitter<void>();

	@Output()
	next: EventEmitter<void> = new EventEmitter<void>();

	constructor() { }

	public skipClick() {
		this.skip.emit();
	}

	public nextClick() {
		this.next.emit();
	}

}
