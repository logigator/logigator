import { Component, DestroyRef, inject, input } from '@angular/core';
import { HexEditorComponent } from '../../ui/hex-editor/hex-editor.component';
import type { MemoryInspection } from './memory-inspection';

/**
 * The hex editor in read-only mode. The addressed word is highlighted and
 * doubles as the active cell, so the editor's own status box reads out the
 * live address and value. The rows it renders go back to the inspection,
 * which loads what they show, and nothing is shown once the view is gone.
 */
@Component({
  selector: 'app-memory-inspection',
  imports: [HexEditorComponent],
  host: { class: 'block h-full' },
  template: `
    <app-hex-editor
      class="block h-full"
      [readOnly]="true"
      [data]="inspection().bytes()"
      [loadedRange]="inspection().loaded()"
      [wordSize]="inspection().wordSize"
      [wordCount]="inspection().wordCount"
      [highlightIndex]="inspection().address()"
      scrollHeight="100%"
      (shownBytes)="inspection().showBytes?.($event)"
    />
  `
})
export class MemoryInspectionComponent {
  public readonly inspection = input.required<MemoryInspection>();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.inspection().showBytes?.(null));
  }
}
