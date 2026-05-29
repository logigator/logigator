import { Type } from '@angular/core';
import { Subject } from 'rxjs';
import { TranslationKey } from '../translation/translation-key.model';

/**
 * Wire slot in `ProjectElement` this option contributes to.
 * - `'n'` → pushed onto the `n` (numbers) array in config-definition order.
 * - `'s'` → written to the `s` (string) field; only one option per component
 *   may claim this slot, and the first one encountered wins.
 * - `null` → no contribution; reserved options (direction/numInputs/numOutputs)
 *   are handled by the persistence layer via the dedicated `r`/`i`/`o` fields.
 */
export type ComponentOptionWireSlot = 'n' | 's' | null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class ComponentOption<T = any> {
	public abstract readonly label: TranslationKey;
	public abstract readonly renderer: Type<unknown>;
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

	/**
	 * Where this option's value lives in the `ProjectElement` wire format.
	 * Concrete subclasses MUST declare this so the persistence layer's
	 * dispatch is compiler-enforced. Returning `null` means the option's
	 * value is intentionally not round-tripped through `n`/`s` — typically
	 * because it's either captured by a reserved field (`r`/`i`/`o`) or has
	 * no wire representation yet.
	 */
	public abstract readonly wireSlot: ComponentOptionWireSlot;

}
