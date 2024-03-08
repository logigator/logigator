// @ts-strict-ignore
import {
	ChangeDetectorRef,
	Component,
	forwardRef,
	Input,
	OnChanges
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

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

	@Input()
	public checked: boolean;

	private onChange: (...args: unknown[]) => unknown = () => {};
	private onTouched: (...args: unknown[]) => unknown = () => {};

	constructor(private cdr: ChangeDetectorRef) {}

	ngOnChanges(): void {
		if (this.checked === undefined) return;
		this.state = this.checked;
	}

	registerOnChange(fn: (...args: unknown[]) => unknown): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: (...args: unknown[]) => unknown): void {
		this.onTouched = fn;
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
