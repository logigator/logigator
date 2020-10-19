import {ChangeDetectorRef, Component, forwardRef, Host, Input, OnInit, Optional, SkipSelf} from '@angular/core';
import {AbstractControl, ControlContainer, ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';

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

	@Input()
	public helpTooltip: string;

	@Input()
	public formControlName: string;

	private control: AbstractControl;

	public state: string;
	public disabled = false;

	public showTooltip = false;

	private onChange = (value: unknown) => {};
	private onTouched = () => {};

	constructor(private cdr: ChangeDetectorRef, @Optional() @Host() @SkipSelf() private controlContainer: ControlContainer) { }

	ngOnInit() {
		if (this.controlContainer) {
			this.control = this.controlContainer.control.get(this.formControlName);
		}
	}

	public get invalid(): boolean {
		if (!this.control)
			return false;

		return this.control.touched && this.control.invalid;
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

	writeValue(value: string): void {
		this.state = value;
		this.cdr.detectChanges();
	}

	public stateChange() {
		this.onTouched();
		this.onChange(this.state);
	}

}
