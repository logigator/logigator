import { ComponentOption } from '../../component-option';
import { TranslationKey } from '../../../translation/translation-key.model';
import { NumberOptionInputComponent } from './number-option-input.component';

export class NumberComponentOption extends ComponentOption<number> {
	public readonly renderer = NumberOptionInputComponent;

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

	protected cloneWithValue(initialValue?: number): NumberComponentOption {
		return new NumberComponentOption(
			this.label,
			this.min,
			this.max,
			initialValue ?? this.value
		);
	}
}
