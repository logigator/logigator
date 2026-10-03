import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
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

/** Tighter than `controlPadding`: a segmented toggle, not a text field. */
const SEGMENT_PADDING: Record<LgSize, string> = {
  sm: 'px-3 py-1 text-sm',
  md: 'px-3 py-1 text-base',
  lg: 'px-4 py-1.5 text-lg',
  xl: 'px-5 py-2 text-xl'
};

/**
 * A segmented group of mutually-exclusive toggle buttons.
 * `ControlValueAccessor` whose value is the selected option's `optionValue`,
 * or the option itself when `optionValue` is unset. Options render their
 * `optionIcon` + `optionLabel`, or a projected `#item` template.
 *
 * A label is one line, always, and a segment is never narrower than the text
 * in it: `fluid` fills the group's width with what is left after every segment
 * has what its own label needs, and a group too narrow for them breaks
 * *between* segments instead of inside one. Both are what keeps a control with
 * three long labels — the visibility picker names states, not values — from
 * turning into a stack of wrapped words.
 *
 * `allowEmpty` defaults to **false**: clicking the active option does not
 * clear the selection.
 */
@Component({
  selector: 'lg-select-button',
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
    <div
      role="group"
      [attr.id]="id() ?? null"
      [attr.aria-label]="ariaLabel() ?? null"
      [attr.aria-labelledby]="ariaLabelledby() ?? null"
      [class]="groupClasses()"
    >
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
  /**
   * Names the group. The options carry `aria-pressed`, but only the group says
   * *what* is being chosen, and a visible caption beside the control counts
   * only when `ariaLabelledby` points at it.
   */
  readonly ariaLabel = input<string>();
  readonly ariaLabelledby = input<string>();
  readonly size = input<LgSize>();
  readonly id = input<string>();

  protected readonly itemTemplate = contentChild<TemplateRef<unknown>>('item');

  protected readonly value = signal<unknown>(undefined);
  protected readonly disabled = signal(false);

  private onChange: (value: unknown) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  // A muted borderless track one step under the pill. The selected segment
  // floats above it as a raised pill, the rest are flat muted text.
  protected readonly groupClasses = computed(() =>
    [
      'rounded-md p-1 bg-surface-100 dark:bg-surface-950',
      // `flex-wrap` is what makes the breaking happen between segments: a
      // second row is a taller control, a label wrapped inside its own segment
      // is an unreadable one. A `fluid` track reaches it first, being as wide
      // as its container rather than as wide as its content, but an inline
      // group is shrink-to-fit and reaches it too, so both carry it.
      this.fluid() ? 'flex w-full flex-wrap' : 'inline-flex flex-wrap'
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
      // One line, so the button's own min-content width is the whole label and
      // nothing can shrink it narrower than that.
      'whitespace-nowrap',
      // `grow` and not `flex-1`: a zero flex basis is what made every segment a
      // third of the track whatever its text, so the longest label ran out of
      // room and broke. Sized from its own content, a segment takes an equal
      // share of the slack instead and the three read as one control.
      this.fluid() ? 'grow' : '',
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
