import {ChangeDetectorRef, Component, forwardRef, Input, OnInit} from '@angular/core';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';

@Component({
	selector: 'app-input',
	templateUrl: './input.component.html',
	styleUrls: ['./input.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => InputComponent),
			multi: true
		}
	]
})
export class InputComponent implements OnInit, ControlValueAccessor {

	@Input()
	public label: string;

	@Input()
	public type = 'text';

	public state: unknown;
	public disabled = false;

	private onChange = (value: unknown) => {};
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
		this.disabled = isDisabled;
	}

	writeValue(value: unknown): void {
		this.state = value;
		this.cdr.detectChanges();
	}

	public stateChange() {
		this.onTouched();
		this.onChange(this.state);
	}

}
