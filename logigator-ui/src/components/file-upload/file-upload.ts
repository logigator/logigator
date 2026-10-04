import { Component, computed, input, output, signal } from '@angular/core';
import { IconSlot } from '../../internal/icon';

export interface LgFileSelectEvent {
  files: File[];
}

/**
 * A file drop zone fronting a hidden native `<input type="file">`. Projected
 * content is a muted hint line under `chooseLabel`; dropped files are filtered
 * against `accept` and capped at `fileLimit`.
 *
 * Selection-only — no HTTP, no auto-upload, no file list. It emits `onSelect`
 * and resets the input, so re-picking the same file fires again.
 */
@Component({
  selector: 'lg-file-upload',
  host: { class: 'block' },
  template: `
    <div
      role="button"
      tabindex="0"
      [attr.aria-label]="chooseLabel() ?? null"
      [class]="zoneClasses()"
      (click)="picker.click()"
      (keydown.enter)="picker.click()"
      (keydown.space)="picker.click(); $event.preventDefault()"
      (dragover)="onDragOver($event)"
      (dragleave)="dragOver.set(false)"
      (drop)="onDrop($event)"
    >
      <!-- pointer-events-none keeps dragleave from firing on child hops -->
      <div class="pointer-events-none flex flex-col items-center gap-2">
        <i [class]="iconClasses()" aria-hidden="true"></i>
        @if (chooseLabel(); as label) {
          <span class="font-medium text-text">{{ label }}</span>
        }
        <span class="text-sm text-muted"><ng-content /></span>
      </div>
    </div>
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
  readonly accept = input<string>();
  readonly fileLimit = input<number>();
  readonly chooseLabel = input<string>();
  readonly chooseIcon = input<IconSlot>();

  readonly onSelect = output<LgFileSelectEvent>();

  protected readonly dragOver = signal(false);

  protected readonly zoneClasses = computed(() =>
    [
      'flex w-full cursor-pointer flex-col items-center justify-center',
      'rounded-md border-2 border-dashed bg-content px-6 py-8 text-center',
      'transition-colors duration-200 focus:outline-none',
      'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-primary',
      this.dragOver()
        ? 'border-primary bg-primary-50 dark:bg-primary/10'
        : 'border-border hover:border-surface-400 dark:hover:border-surface-500'
    ].join(' ')
  );

  protected readonly iconClasses = computed(
    () =>
      `${this.chooseIcon() ?? 'ph ph-cloud-arrow-up'} text-3xl ${
        this.dragOver() ? 'text-primary' : 'text-muted'
      }`
  );

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
      this.accepts(file)
    );
    this.emitFiles(files);
  }

  protected onChange(el: HTMLInputElement): void {
    this.emitFiles(el.files ? Array.from(el.files) : []);
    el.value = '';
  }

  private emitFiles(files: File[]): void {
    const limit = this.fileLimit();
    const limited = limit ? files.slice(0, limit) : files;
    if (limited.length) {
      this.onSelect.emit({ files: limited });
    }
  }

  /** Mirrors the picker's `accept` filter for dropped files. */
  private accepts(file: File): boolean {
    const accept = this.accept();
    if (!accept) {
      return true;
    }
    const name = file.name.toLowerCase();
    const type = file.type.toLowerCase();
    return accept
      .split(',')
      .map((token) => token.trim().toLowerCase())
      .some((token) => {
        if (token.startsWith('.')) {
          return name.endsWith(token);
        }
        if (token.endsWith('/*')) {
          return type.startsWith(token.slice(0, -1));
        }
        return type === token;
      });
  }
}
