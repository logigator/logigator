import { ComponentOption } from '../component-option';
import { TranslationKey } from '../../translation/translation-key.model';

export class SelectComponentOption<T> extends ComponentOption<T> {
	constructor(
		public readonly label: TranslationKey,
		public readonly options: { value: T; label?: string; icon?: string }[],
		defaultValue: T,
		public readonly type: 'button' | 'dropdown' = 'dropdown'
	) {
		super(defaultValue);
	}

	clone(initialValue?: T): SelectComponentOption<T> {
		return new SelectComponentOption<T>(
			this.label,
			this.options,
			initialValue ?? this.value
		);
	}
}
