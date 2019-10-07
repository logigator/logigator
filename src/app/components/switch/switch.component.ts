import {ChangeDetectorRef, Component, forwardRef, OnInit} from '@angular/core';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';
import {isBoolean} from 'util';

@Component({
	selector: 'app-switch',
	templateUrl: './switch.component.html',
	styleUrls: ['./switch.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => SwitchComponent),
			multi: true
		}
	]
})
export class SwitchComponent implements OnInit, ControlValueAccessor {

	public state: boolean;

	private onChange = (value: boolean) => {};
	private onTouched = () => {};

	constructor(private cdr: ChangeDetectorRef) { }

	ngOnInit() {
	}

	registerOnChange(fn: any): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: any): void {
		this.onTouched = fn;
	}

	setDisabledState(isDisabled: boolean): void {
	}

	writeValue(value: boolean): void {
		this.state = value;
		this.cdr.detectChanges();
	}

	public switchClick() {
		this.state = !this.state;
		console.log(this.state);
		this.onChange(this.state);
		this.onTouched();
	}

}
