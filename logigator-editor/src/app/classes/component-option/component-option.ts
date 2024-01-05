export enum ComponentOptionType {
	Number,
	Select,
	Checkbox
}

export abstract class ComponentOption<T> {
	public abstract readonly type: ComponentOptionType;
	public abstract readonly label: string;
	public onChange: ((value: T) => void) | null = null;

	private _value: T;

	protected constructor(value: T) {
		this._value = value;
	}

	get value(): T {
		return this._value;
	}

	set value(value: T) {
		this._value = value;
		if (this.onChange) this.onChange(value);
	}

	public abstract clone(): ComponentOption<T>;
}
