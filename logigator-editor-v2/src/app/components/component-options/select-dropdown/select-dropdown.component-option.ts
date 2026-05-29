import {
	ComponentOption,
	ComponentOptionWireSlot
} from '../../component-option';
import { TranslationKey } from '../../../translation/translation-key.model';
import { SelectDropdownOptionInputComponent } from './select-dropdown-option-input.component';

export class SelectDropdownComponentOption<T> extends ComponentOption<T> {
	public readonly renderer = SelectDropdownOptionInputComponent;
	// Generic select-dropdown values aren't reliably representable in the wire
	// format. Subclasses with custom persistence must override.
	public readonly wireSlot: ComponentOptionWireSlot = null;

	constructor(
		public readonly label: TranslationKey,
		public readonly options: { value: T; label?: string; icon?: string }[],
		defaultValue: T
	) {
		super(defaultValue);
	}

	clone(initialValue?: T): SelectDropdownComponentOption<T> {
		return new SelectDropdownComponentOption<T>(
			this.label,
			this.options,
			initialValue ?? this.value
		);
	}
}
