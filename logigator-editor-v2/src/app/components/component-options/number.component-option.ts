import { ComponentOption, ComponentOptionType } from '../component-option';

export class NumberComponentOption extends ComponentOption<number> {
	public readonly type = ComponentOptionType.Number;

	constructor(
		public readonly label: string,
		public readonly min: number,
		public readonly max: number,
		defaultValue: number
	) {
		super(defaultValue);
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
