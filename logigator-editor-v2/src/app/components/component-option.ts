import { Subject } from 'rxjs';
import { TranslationKey } from '../translation/translation-key.model';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class ComponentOption<T = any> {
	public abstract readonly label: TranslationKey;
	public onChange$ = new Subject<T>();

	private _value: T;

	protected constructor(value: T) {
		this._value = value;
	}

	get value(): T {
		return this._value;
	}

	set value(value: T) {
		this._value = value;
		this.onChange$.next(value);
	}

	public abstract clone(initialValue?: T): ComponentOption<T>;
}
