import { Component, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LgButton, LgDialog, LgTextarea } from '@logigator/ui';
import { TranslocoDirective } from '@jsverse/transloco';
import type { ComponentOptionInput } from '../../component-option';
import type { TextAreaComponentOption } from './text-area.component-option';

@Component({
  selector: 'app-text-area-option-input',
  imports: [FormsModule, LgButton, LgDialog, LgTextarea, TranslocoDirective],
  templateUrl: './text-area-option-input.component.html'
})
export class TextAreaOptionInputComponent implements ComponentOptionInput<string> {
  public readonly option = input.required<TextAreaComponentOption>();
  public readonly commit = input.required<(value: string) => void>();
  protected readonly dialogVisible = signal(false);
  protected readonly draft = signal('');

  protected open(): void {
    this.draft.set(this.option().value);
    this.dialogVisible.set(true);
  }

  protected save(): void {
    this.commit()(this.draft());
    this.dialogVisible.set(false);
  }

  protected cancel(): void {
    this.dialogVisible.set(false);
  }
}
