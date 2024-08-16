import { ComponentOption, ComponentOptionType } from '../component-option';

export class CheckboxComponentOption extends ComponentOption<boolean> {
	public readonly type = ComponentOptionType.Checkbox;

	constructor(
		public readonly label: string,
		defaultValue: boolean
	) {
		super(defaultValue);
	}

	clone(): CheckboxComponentOption {
		return new CheckboxComponentOption(this.label, this.value);
	}
}
