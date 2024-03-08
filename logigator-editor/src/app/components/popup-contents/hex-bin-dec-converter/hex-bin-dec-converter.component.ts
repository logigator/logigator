import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PopupContentComp } from '../../popup/popup-content-comp';
import { UntypedFormControl, Validators } from '@angular/forms';

@Component({
	selector: 'app-hex-bin-dec-converter',
	templateUrl: './hex-bin-dec-converter.component.html',
	styleUrls: ['./hex-bin-dec-converter.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class HexBinDecConverterComponent extends PopupContentComp<
	never,
	never
> {
	public hex = new UntypedFormControl(
		'0',
		Validators.pattern(/^([0-9]|[A-Fa-f])+$/)
	);
	public bin = new UntypedFormControl('0', Validators.pattern('^(1|0)+$'));
	public dec = new UntypedFormControl('0', Validators.min(0));

	public hexInput() {
		if (this.hex.value === '') return;
		const value = parseInt(this.hex.value, 16);
		if (this.hex.invalid || isNaN(value)) {
			this.dec.setValue('Invalid');
			this.bin.setValue('Invalid');
		} else {
			this.dec.setValue(value.toString(10));
			this.bin.setValue(value.toString(2));
		}
	}

	public binInput() {
		if (this.bin.value === '') return;
		const value = parseInt(this.bin.value, 2);
		if (this.bin.invalid || isNaN(value)) {
			this.dec.setValue('Invalid');
			this.hex.setValue('Invalid');
		} else {
			this.dec.setValue(value.toString(10));
			this.hex.setValue(value.toString(16));
		}
	}

	public decInput() {
		if (this.dec.value === '') return;
		const value = parseInt(this.dec.value, 10);
		if (this.dec.invalid || isNaN(value)) {
			this.bin.setValue('Invalid');
			this.hex.setValue('Invalid');
		} else {
			this.dec.setValue(value);
			this.bin.setValue(value.toString(2));
			this.hex.setValue(value.toString(16));
		}
	}
}
