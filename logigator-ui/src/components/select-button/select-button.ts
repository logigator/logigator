import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  forwardRef,
  input,
  signal,
  TemplateRef
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LgSize } from '../../tokens/size';

/** Segment padding, keyed by size — tighter than `controlPadding` (a segmented toggle, not a text field). */
const SEGMENT_PADDING: Record<LgSize, string> = {
  sm: 'px-3 py-1 text-sm',
  md: 'px-3 py-1 text-base',
  lg: 'px-4 py-1.5 text-lg',
  xl: 'px-5 py-2 text-xl'
};

/**
 * A segmented group of mutually-exclusive toggle buttons. `ControlValueAccessor`
 * (value = the selected option's `optionValue`, or the option itself when
 * `optionValue` is unset). Each option renders its `optionIcon` + `optionLabel`
 * by default, or a projected `#item` template (`$implicit` = the option) for
 * fully custom content.
 *
 * `allowEmpty` defaults to **false**: clicking the active option does NOT clear
 * the selection (the editor's segmented toggles must always have a value).
 */
@Component({
  selector: 'lg-select-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  host: { class: 'inline-flex', '[class.w-full]': 'fluid()' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => LgSelectButton),
      multi: true
    }
  ],
  template: `
    <div role="group" [attr.id]="id() ?? null" [class]="groupClasses()">
      @for (option of options(); track $index) {
        <button
          type="button"
          [attr.aria-pressed]="isSelected(option)"
          [disabled]="disabled()"
          [class]="buttonClasses(isSelected(option))"
          (click)="select(option)"
          (blur)="onTouched()"
        >
          @if (itemTemplate(); as tpl) {
            <ng-container
              *ngTemplateOutlet="
                tpl;
                context: { $implicit: option, index: $index }
              "
            ></ng-container>
          } @else {
            @if (iconOf(option); as ic) {
              <i [class]="ic" aria-hidden="true"></i>
            }
            @if (label(option); as lbl) {
              <span>{{ lbl }}</span>
            }
          }
        </button>
      }
    </div>
  `
})
export class LgSelectButton implements ControlValueAccessor {
  readonly options = input<readonly unknown[]>([]);
  readonly optionLabel = input<string>();
  readonly optionValue = input<string>();
  readonly optionIcon = input<string>();
  readonly allowEmpty = input(false, { transform: booleanAttribute });
  readonly fluid = input(false, { transform: booleanAttribute });
  readonly size = input<LgSize>();
  readonly id = input<string>();

  protected readonly itemTemplate = contentChild<TemplateRef<unknown>>('item');

  protected readonly value = signal<unknown>(undefined);
  protected readonly disabled = signal(false);

  private onChange: (value: unknown) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  // The group is a muted "track" (no border) one step under the pill: Aura's
  // surface-100 in light, surface-950 in dark. The selected segment floats
  // above it as a raised pill, the rest are flat muted text — Aura's
  // segmented-toggle look, not a primary fill.
  protected readonly groupClasses = computed(() =>
    [
      'rounded-md p-1 bg-surface-100 dark:bg-surface-950',
      this.fluid() ? 'flex w-full' : 'inline-flex'
    ].join(' ')
  );

  protected resolveValue(option: unknown): unknown {
    const key = this.optionValue();
    return key ? (option as Record<string, unknown>)[key] : option;
  }

  protected label(option: unknown): string {
    const key = this.optionLabel();
    const raw = key
      ? (option as Record<string, unknown>)[key]
      : this.resolveValue(option);
    return raw == null ? '' : String(raw);
  }

  /** The option's icon class (`optionIcon` field), or undefined for none. */
  protected iconOf(option: unknown): string | undefined {
    const key = this.optionIcon();
    const raw = key ? (option as Record<string, unknown>)[key] : undefined;
    return typeof raw === 'string' && raw !== '' ? raw : undefined;
  }

  protected isSelected(option: unknown): boolean {
    return this.value() === this.resolveValue(option);
  }

  protected buttonClasses(selected: boolean): string {
    const pad = SEGMENT_PADDING[this.size() ?? 'md'];
    return [
      'inline-flex items-center justify-center gap-1 rounded-md font-medium',
      'transition-colors duration-200 cursor-pointer select-none',
      'disabled:pointer-events-none disabled:opacity-60',
      'focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-primary',
      this.fluid() ? 'flex-1' : '',
      pad,
      selected
        ? 'bg-surface-0 dark:bg-surface-800 text-surface-900 dark:text-text shadow-xs'
        : 'text-muted hover:text-surface-700 dark:hover:text-surface-300'
    ]
      .filter(Boolean)
      .join(' ');
  }

  protected select(option: unknown): void {
    if (this.disabled()) {
      return;
    }
    if (this.isSelected(option)) {
      if (this.allowEmpty()) {
        this.commit(undefined);
      }
      return;
    }
    this.commit(this.resolveValue(option));
  }

  private commit(value: unknown): void {
    this.value.set(value);
    this.onChange(value);
  }

  writeValue(value: unknown): void {
    this.value.set(value);
  }

  registerOnChange(fn: (value: unknown) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }
}
