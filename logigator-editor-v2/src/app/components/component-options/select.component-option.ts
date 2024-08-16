import { ComponentOption, ComponentOptionType } from '../component-option';

export class SelectComponentOption<T> extends ComponentOption<T> {
	public readonly type = ComponentOptionType.Select;

	constructor(
		public readonly label: string,
		public readonly options: { value: T; label: string }[],
		defaultValue: T
	) {
		super(defaultValue);
	}

	clone(): SelectComponentOption<T> {
		return new SelectComponentOption<T>(this.label, this.options, this.value);
	}
}
