import { ComponentOption } from '../component-option';
import { TranslationKey } from '../../translation/translation-key.model';

export class NumberComponentOption extends ComponentOption<number> {
	constructor(
		public readonly label: TranslationKey,
		public readonly min: number,
		public readonly max: number,
		defaultValue: number
	) {
		super(defaultValue);
	}

	override set value(value: number) {
		if (value < this.min) {
			value = this.min;
		} else if (value > this.max) {
			value = this.max;
		}
		super.value = value;
	}

	override get value(): number {
		return super.value;
	}

	clone(): NumberComponentOption {
		return new NumberComponentOption(
			this.label,
			this.min,
			this.max,
			this.value
		);
	}
}
