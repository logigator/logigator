import { ComponentOption } from '../../component-option';
import { TranslationKey } from '../../../translation/translation-key.model';
import { SelectDropdownOptionInputComponent } from './select-dropdown-option-input.component';

export class SelectDropdownComponentOption<T> extends ComponentOption<T> {
  public readonly renderer = SelectDropdownOptionInputComponent;

  constructor(
    public readonly label: TranslationKey,
    public readonly options: { value: T; label?: string; icon?: string }[],
    defaultValue: T
  ) {
    super(defaultValue);
  }

  protected cloneWithValue(initialValue?: T): SelectDropdownComponentOption<T> {
    return new SelectDropdownComponentOption<T>(
      this.label,
      this.options,
      initialValue ?? this.value
    );
  }
}
