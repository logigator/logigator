export enum ComponentOptionType {
	Number,
	Select,
	Checkbox
}

abstract class AbstractComponentOption<T> {

	private _value: T | null = null;

	public abstract readonly type: ComponentOptionType;
	public abstract readonly label: string;
	public abstract readonly defaultValue: T;
	public abstract readonly onChange: (value: T) => void;

	get value(): T {
		return this._value ?? this.defaultValue;
	}

	set value(value: T) {
		this._value = value;
	}

}

export class NumberComponentOption extends AbstractComponentOption<number> {
	readonly type = ComponentOptionType.Number;

	constructor(
		public readonly label: string,
		public readonly min: number,
		public readonly max: number,
		public readonly defaultValue: number,
		public readonly onChange: (value: number) => void = () => { }
	) {
		super();
	}
}

export class SelectComponentOption extends AbstractComponentOption<string> {
	readonly type = ComponentOptionType.Select;

	constructor(
		public readonly label: string,
		public readonly options: { value: string; label?: string }[],
		public readonly defaultValue: string,
		public readonly onChange: (value: string) => void = () => { }
	) {
		super();
	}
}

export type ComponentOption = NumberComponentOption | SelectComponentOption;
