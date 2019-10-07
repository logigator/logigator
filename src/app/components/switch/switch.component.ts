import {ChangeDetectorRef, Component, forwardRef, Input, OnChanges, OnInit, SimpleChanges} from '@angular/core';
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
export class SwitchComponent implements OnChanges, ControlValueAccessor {

	public state: boolean;

	private onChange = (value: boolean) => {};
	private onTouched = () => {};

	@Input()
	public checked: boolean;

	constructor(private cdr: ChangeDetectorRef) { }

	ngOnChanges(changes: SimpleChanges): void {
		if (this.checked === undefined) return;
		this.state = this.checked;
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
		this.onChange(this.state);
		this.onTouched();
	}

}
