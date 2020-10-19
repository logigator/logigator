import {Component, Input, ViewEncapsulation} from '@angular/core';
import {NgControl} from '@angular/forms';

@Component({
	selector: 'app-input-error',
	templateUrl: './input-error.component.html',
	styleUrls: ['./input-error.component.scss'],
	encapsulation: ViewEncapsulation.None
})
export class InputErrorComponent {

	@Input()
	error?: string;

	constructor(private control: NgControl) { }

	public get showError(): boolean {
		if (this.error) {
			return this.control.touched && this.control.errors && this.control.errors[this.error];
		}
		return this.control.touched;
	}

}
