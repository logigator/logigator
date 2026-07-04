import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { HexEditorComponent } from '../../../ui/hex-editor/hex-editor.component';
import type { RomInspection } from './rom-inspection';

/**
 * Renderer for {@link RomInspection}: a live address/value readout above the
 * hex editor in read-only mode, whose highlighted cell tracks the addressed
 * word. Fills whatever the presenter frames it in (window body / sheet).
 */
@Component({
  selector: 'app-rom-inspection',
  imports: [TranslocoDirective, HexEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex h-full flex-col gap-2' },
  template: `
    <div
      *transloco="let t"
      class="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border bg-content px-3 py-1.5 text-sm"
    >
      <div class="flex gap-1">
        <span class="text-muted">{{ t('hexEditor.activeAddress') }}:</span>
        <span class="font-mono">0x{{ addressHex() }}</span>
      </div>
      <div class="flex gap-1">
        <span class="text-muted">{{ t('hexEditor.value') }}:</span>
        <span class="font-mono">0x{{ valueHex() }}</span>
        <span class="text-muted">({{ valueDecimal() }})</span>
      </div>
    </div>
    <app-hex-editor
      class="block min-h-0 grow"
      [readOnly]="true"
      [data]="inspection().bytes"
      [wordSize]="inspection().wordSize"
      [wordCount]="inspection().wordCount"
      [highlightIndex]="inspection().address()"
      scrollHeight="100%"
    />
  `
})
export class RomInspectionComponent {
  public readonly inspection = input.required<RomInspection>();

  private readonly addressDigits = computed(() =>
    Math.max(2, (this.inspection().wordCount - 1).toString(16).length)
  );

  protected readonly addressHex = computed(() =>
    this.inspection()
      .address()
      .toString(16)
      .toUpperCase()
      .padStart(this.addressDigits(), '0')
  );

  protected readonly valueHex = computed(() => {
    const { wordSize } = this.inspection();
    return this.inspection()
      .value()
      .toString(16)
      .toUpperCase()
      .padStart(Math.ceil(wordSize / 4), '0');
  });

  protected readonly valueDecimal = computed(() =>
    this.inspection().value().toString(10)
  );
}
