import { Component, inject, input } from '@angular/core';
import { TranslationService } from '../../../translation/translation.service';
import { DialogService } from '@logigator/ui';
import { DialogId } from '../../../analytics/analytics.mapping';
import { DOCS_LINKS } from '../../../documentation/docs-links';
import { DocumentationService } from '../../../documentation/documentation.service';
import { ComponentOptionInput } from '../../component-option';
import type { MemoryDataComponentOption } from './memory-data.component-option';
import { HexEditorComponent } from '../../../ui/hex-editor/hex-editor.component';
import {
  base64ToBytes,
  bytesToBase64,
  trimTrailingZeros
} from '../../../utils/packed-buffer';
import { DialogOptionButtonComponent } from '../dialog-option-button/dialog-option-button.component';

/**
 * Opens the generic {@link HexEditorComponent} in a dialog and adapts between
 * the stored base64 bit-packed blob and the editor's `Uint8Array` +
 * dimensions contract. Nothing component-specific lives in the hex editor.
 */
@Component({
  selector: 'app-memory-data-option-input',
  imports: [DialogOptionButtonComponent],
  templateUrl: './memory-data-option-input.component.html'
})
export class MemoryDataOptionInputComponent implements ComponentOptionInput<string> {
  private readonly dialogService = inject(DialogService);
  private readonly translation = inject(TranslationService);
  private readonly documentation = inject(DocumentationService);

  public readonly option = input.required<MemoryDataComponentOption>();
  public readonly commit = input.required<(value: string) => void>();

  /** How many of the words hold a value, or that none does. */
  protected summary(): string {
    const opt = this.option();
    const count = opt.nonZeroWords();
    return count === 0
      ? this.translation.translate('components.options.memory.empty')
      : this.translation.translate('components.options.memory.summary', {
          count,
          total: opt.wordCount()
        });
  }

  protected open(): void {
    const opt = this.option();
    const ref = this.dialogService.open(HexEditorComponent, {
      header: this.translation.translate(
        'components.def.ROM.options.dataEditorTitle'
      ),
      modal: true,
      closable: true,
      help: this.documentation.helpAction(DOCS_LINKS.romEditor),
      dismissableMask: false,
      telemetryId: DialogId.RomDataEditor,
      width: '64rem',
      style: { maxWidth: '100dvw', maxHeight: '100dvh' },
      inputValues: {
        data: base64ToBytes(opt.value),
        wordSize: opt.wordSize(),
        wordCount: opt.wordCount()
      }
    });
    if (!ref) return;

    // The editor is decoupled from the dialog, so bridge its outputs here.
    ref.onChildComponentLoaded.subscribe((editor) => {
      editor.saved.subscribe((bytes) => {
        this.commit()(bytesToBase64(trimTrailingZeros(bytes)));
        ref.close();
      });
      editor.dismissed.subscribe(() => ref.close());
    });
  }
}
