import { ComponentOption } from '../../component-option';
import { TranslationKey } from '../../../translation/translation-key.model';
import { SelectButtonOptionInputComponent } from './select-button-option-input.component';

export class SelectButtonComponentOption<T> extends ComponentOption<T> {
	public readonly renderer = SelectButtonOptionInputComponent;

	constructor(
		public readonly label: TranslationKey,
		public readonly options: { value: T; label?: string; icon?: string }[],
		defaultValue: T
	) {
		super(defaultValue);
	}

	clone(initialValue?: T): SelectButtonComponentOption<T> {
		return new SelectButtonComponentOption<T>(
			this.label,
			this.options,
			initialValue ?? this.value
		);
	}
}
