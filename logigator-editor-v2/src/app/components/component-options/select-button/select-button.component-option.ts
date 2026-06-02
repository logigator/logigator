import {
	ComponentOption,
	ComponentOptionWireSlot
} from '../../component-option';
import { TranslationKey } from '../../../translation/translation-key.model';
import { SelectButtonOptionInputComponent } from './select-button-option-input.component';

export class SelectButtonComponentOption<T> extends ComponentOption<T> {
	public readonly renderer = SelectButtonOptionInputComponent<T>;
	// Generic select-button values aren't reliably representable in the wire
	// format. Reserved subclasses (e.g. Direction, captured by `r`) override
	// this implicitly via being handled in the persistence layer's reserved
	// keys table. Subclasses with custom persistence must override.
	public readonly wireSlot: ComponentOptionWireSlot = null;

	constructor(
		public readonly label: TranslationKey,
		public readonly options: { value: T; label?: string; icon?: string }[],
		defaultValue: T
	) {
		super(defaultValue);
	}

	protected cloneWithValue(initialValue?: T): SelectButtonComponentOption<T> {
		return new SelectButtonComponentOption<T>(
			this.label,
			this.options,
			initialValue ?? this.value
		);
	}
}
