import {
	ComponentOption,
	ComponentOptionWireSlot
} from '../../component-option';
import { TranslationKey } from '../../../translation/translation-key.model';
import { TextAreaOptionInputComponent } from './text-area-option-input.component';

const DEFAULT_MAX_LENGTH = 10000;

export interface TextAreaComponentOptionConfig {
	dialogTitle?: TranslationKey;
	placeholder?: TranslationKey;
	maxLength?: number;
}

export class TextAreaComponentOption extends ComponentOption<string> {
	public readonly renderer = TextAreaOptionInputComponent;
	public readonly wireSlot: ComponentOptionWireSlot = 's';
	public readonly dialogTitle: TranslationKey;
	public readonly placeholder: TranslationKey | undefined;
	public readonly maxLength: number;

	constructor(
		public readonly label: TranslationKey,
		defaultValue = '',
		options: TextAreaComponentOptionConfig = {}
	) {
		const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
		super(defaultValue.slice(0, maxLength));
		this.dialogTitle = options.dialogTitle ?? label;
		this.placeholder = options.placeholder;
		this.maxLength = maxLength;
	}

	override set value(value: string) {
		super.value =
			value.length > this.maxLength ? value.slice(0, this.maxLength) : value;
	}

	override get value(): string {
		return super.value;
	}

	protected cloneWithValue(initialValue?: string): TextAreaComponentOption {
		return new TextAreaComponentOption(this.label, initialValue ?? this.value, {
			dialogTitle: this.dialogTitle,
			placeholder: this.placeholder,
			maxLength: this.maxLength
		});
	}
}
