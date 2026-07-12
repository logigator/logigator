import { Component, inject, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { TranslationService } from '../../../translation/translation.service';
import { DialogService, LgButton } from '@logigator/ui';
import { ComponentOptionInput } from '../../component-option';
import type { MemoryDataComponentOption } from './memory-data.component-option';
import { HexEditorComponent } from '../../../ui/hex-editor/hex-editor.component';
import {
  base64ToBytes,
  bytesToBase64,
  trimTrailingZeros
} from '../../../utils/packed-buffer';

/**
 * Side-panel renderer for {@link MemoryDataComponentOption}. It opens the
 * generic {@link HexEditorComponent} in a dialog and adapts
 * between the stored value (a base64 bit-packed blob) and the editor's
 * `Uint8Array` + dimensions contract: decoding the blob and snapshotting the
 * dimensions as the dialog's input values, then trimming and re-encoding the
 * editor's `save` output. Nothing component-specific lives in the editor.
 */
@Component({
  selector: 'app-memory-data-option-input',
  imports: [TranslocoDirective, LgButton],
  templateUrl: './memory-data-option-input.component.html'
})
export class MemoryDataOptionInputComponent implements ComponentOptionInput<string> {
  private readonly dialogService = inject(DialogService);
  private readonly translation = inject(TranslationService);

  public readonly option = input.required<MemoryDataComponentOption>();
  public readonly commit = input.required<(value: string) => void>();

  protected open(): void {
    const opt = this.option();
    const ref = this.dialogService.open(HexEditorComponent, {
      header: this.translation.translate(
        'components.def.ROM.options.dataEditorTitle'
      ),
      modal: true,
      closable: true,
      dismissableMask: false,
      width: '64rem',
      style: { maxWidth: '100dvw', maxHeight: '100dvh' },
      inputValues: {
        data: base64ToBytes(opt.value),
        wordSize: opt.wordSize(),
        wordCount: opt.wordCount()
      }
    });
    if (!ref) return;

    // The editor is decoupled from the dialog, so bridge its outputs here:
    // commit + trim on save, close on either save or cancel.
    ref.onChildComponentLoaded.subscribe((editor) => {
      editor.saved.subscribe((bytes) => {
        this.commit()(bytesToBase64(trimTrailingZeros(bytes)));
        ref.close();
      });
      editor.dismissed.subscribe(() => ref.close());
    });
  }
}
