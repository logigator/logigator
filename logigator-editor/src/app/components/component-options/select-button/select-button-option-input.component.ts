import { Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LgSelectButton } from '@logigator/ui';
import type { ComponentOptionInput } from '../../component-option';
import type { SelectButtonComponentOption } from './select-button.component-option';
import { TranslateDirective } from '../../../translation/translate.directive';
import { TranslationService } from '../../../translation/translation.service';
import { captionedChoices } from '../option-choice';

let nextId = 0;

@Component({
  selector: 'app-select-button-option-input',
  imports: [FormsModule, LgSelectButton, TranslateDirective],
  templateUrl: './select-button-option-input.component.html'
})
export class SelectButtonOptionInputComponent<
  T
> implements ComponentOptionInput<T> {
  private readonly translation = inject(TranslationService);

  public readonly option = input.required<SelectButtonComponentOption<T>>();
  public readonly commit = input.required<(value: T) => void>();
  protected readonly choices = computed(() =>
    captionedChoices(this.translation, this.option().options)
  );
  // Labels the group by reference; see LgSelectButton's `ariaLabelledby`.
  protected readonly labelId = `component-settings-input-${++nextId}`;
}
