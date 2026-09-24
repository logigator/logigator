import { Component, input } from '@angular/core';
import { HexEditorComponent } from '../../../ui/hex-editor/hex-editor.component';
import type { RomInspection } from './rom-inspection';

/**
 * The hex editor in read-only mode. The addressed word is highlighted and
 * doubles as the active cell, so the editor's own status box reads out the
 * live address and value.
 */
@Component({
  selector: 'app-rom-inspection',
  imports: [HexEditorComponent],
  host: { class: 'block h-full' },
  template: `
    <app-hex-editor
      class="block h-full"
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
}
