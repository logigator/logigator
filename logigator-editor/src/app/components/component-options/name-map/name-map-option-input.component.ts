import { Component, inject, input } from '@angular/core';
import { NameMap } from '@logigator/core';
import { DialogService, LgButton } from '@logigator/ui';
import { DialogId } from '../../../analytics/analytics.mapping';
import { TranslationService } from '../../../translation/translation.service';
import { TranslateDirective } from '../../../translation/translate.directive';
import { ComponentOptionInput } from '../../component-option';
import type { NameMapComponentOption } from './name-map.component-option';
import { NameMapDialogComponent } from './name-map-dialog.component';

/**
 * A full-width row button naming how many shown keys carry a name, opening the
 * owner's editor in a dialog. A save is one `commit`, so a whole rename is one
 * undo step. With no editor attached there is nothing to open, and the row is
 * not drawn.
 */
@Component({
  selector: 'app-name-map-option-input',
  imports: [LgButton, TranslateDirective],
  templateUrl: './name-map-option-input.component.html',
  // Without an editor the host stays empty, and `contents` keeps it from
  // taking a gap in the form's column.
  host: { class: 'contents' }
})
export class NameMapOptionInputComponent implements ComponentOptionInput<NameMap> {
  private readonly dialogService = inject(DialogService);
  private readonly translation = inject(TranslationService);

  public readonly option = input.required<NameMapComponentOption>();
  public readonly commit = input.required<(value: NameMap) => void>();

  /** How many of the keys the dialog lists carry a name. */
  protected namedCount(): number {
    const names = this.option().value;
    return this.option()
      .visibleKeys()
      .filter((key) => Object.hasOwn(names, key)).length;
  }

  protected open(): void {
    const opt = this.option();
    if (!opt.editor) return;
    const ref = this.dialogService.open(NameMapDialogComponent, {
      header: this.translation.translate(opt.label),
      modal: true,
      closable: true,
      dismissableMask: false,
      telemetryId: DialogId.NameMapEditor,
      width: '40rem',
      style: { maxWidth: '100dvw', maxHeight: '100dvh' },
      data: {
        editor: opt.editor,
        keys: opt.visibleKeys(),
        names: opt.value,
        maxLength: opt.maxLength
      }
    });

    ref.onClose.subscribe((names) => {
      if (names !== undefined) this.commit()(names);
    });
  }
}
