import { NumberComponentOption } from './number.component-option';

export class InputNumberComponentOption extends NumberComponentOption {
	constructor(min: number, max: number, defaultValue: number) {
		super('SETTINGS_INFO.INPUTS', min, max, defaultValue);
	}
}
