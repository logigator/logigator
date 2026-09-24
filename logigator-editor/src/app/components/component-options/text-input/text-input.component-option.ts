import { ComponentOption } from '../../component-option';
import { TranslationKey } from '../../../translation/translation-key.model';
import { TextInputOptionInputComponent } from './text-input-option-input.component';

const DEFAULT_MAX_LENGTH = 1000;

export interface TextInputComponentOptionConfig {
  placeholder?: TranslationKey;
  /** Hard cap on the value length; `DEFAULT_MAX_LENGTH` when omitted. */
  maxLength?: number;
  /** Characters stripped from the value on every write; none when omitted. */
  forbiddenChars?: RegExp;
}

/**
 * A short, single-line text option, counterpart to the dialog `<textarea>` of
 * {@link TextAreaComponentOption}. Length and character constraints come from
 * the consumer, not baked in: port labels ask for `maxLength: 5` and
 * `forbiddenChars: /,/g` because the label column is comma-joined.
 */
export class TextInputComponentOption extends ComponentOption<string> {
  public readonly renderer = TextInputOptionInputComponent;
  public readonly placeholder: TranslationKey | undefined;
  public readonly maxLength: number | undefined;
  public readonly forbiddenChars: RegExp | undefined;

  constructor(
    public readonly label: TranslationKey,
    defaultValue = '',
    options: TextInputComponentOptionConfig = {}
  ) {
    const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
    super(
      TextInputComponentOption.sanitize(
        defaultValue,
        maxLength,
        options.forbiddenChars
      )
    );
    this.placeholder = options.placeholder;
    this.maxLength = maxLength;
    this.forbiddenChars = options.forbiddenChars;
  }

  private static sanitize(
    value: string,
    maxLength: number | undefined,
    forbiddenChars: RegExp | undefined
  ): string {
    let sanitized = forbiddenChars ? value.replace(forbiddenChars, '') : value;
    if (maxLength !== undefined && sanitized.length > maxLength) {
      sanitized = sanitized.slice(0, maxLength);
    }
    return sanitized;
  }

  override set value(value: string) {
    super.value = TextInputComponentOption.sanitize(
      value,
      this.maxLength,
      this.forbiddenChars
    );
  }

  override get value(): string {
    return super.value;
  }

  protected cloneWithValue(initialValue?: string): TextInputComponentOption {
    return new TextInputComponentOption(
      this.label,
      initialValue ?? this.value,
      {
        placeholder: this.placeholder,
        maxLength: this.maxLength,
        forbiddenChars: this.forbiddenChars
      }
    );
  }
}
