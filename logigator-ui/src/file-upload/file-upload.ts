import {
  ChangeDetectionStrategy,
  Component,
  input,
  output
} from '@angular/core';
import { IconSlot } from '../internal/icon';
import { LgButton } from '../button/button';

/** Emitted when the user picks file(s). */
export interface LgFileSelectEvent {
  files: File[];
}

/**
 * A basic file picker: a styled {@link LgButton} fronting a hidden native
 * `<input type="file">`. Selection-only (no HTTP/auto-upload, no dropzone or
 * file list); emits `onSelect` with the chosen files and resets the input so
 * re-picking the same file fires again.
 */
@Component({
  selector: 'lg-file-upload',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LgButton],
  host: { class: 'inline-flex' },
  template: `
    <lg-button
      severity="secondary"
      [label]="chooseLabel()"
      [icon]="chooseIcon()"
      (onClick)="picker.click()"
    ></lg-button>
    <input
      #picker
      type="file"
      class="hidden"
      [accept]="accept()"
      [multiple]="fileLimit() !== 1"
      (change)="onChange(picker)"
    />
  `
})
export class LgFileUpload {
  /** Only `'basic'` is implemented (the choose button). */
  readonly mode = input<'basic'>('basic');
  readonly accept = input<string>();
  readonly fileLimit = input<number>();
  /** Accepted for signature parity — selection never auto-uploads regardless. */
  readonly customUpload = input(false);
  readonly chooseLabel = input<string>();
  readonly chooseIcon = input<IconSlot>();

  readonly onSelect = output<LgFileSelectEvent>();

  protected onChange(el: HTMLInputElement): void {
    const files = el.files ? Array.from(el.files) : [];
    if (files.length) {
      this.onSelect.emit({ files });
    }
    el.value = '';
  }
}
