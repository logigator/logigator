import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  signal
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { controlPadding, LgSize } from '../../tokens/size';

/**
 * A numeric input with optional stacked +/- spinner buttons.
 * `ControlValueAccessor` (value = `number`). Plain integer/decimal entry only —
 * no currency, locale, grouping, prefix/suffix or hold-to-repeat.
 *
 * The wrapper carries the field border (and the focus-within border switch);
 * the inner `<input>` is borderless. `min`/`max` clamp on step and on blur.
 */
@Component({
  selector: 'lg-input-number',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => LgInputNumber),
      multi: true
    }
  ],
  template: `
    <div [class]="wrapperClasses()">
      <input
        [id]="inputId()"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        [class]="fieldClasses()"
        [value]="text()"
        [disabled]="disabled()"
        (input)="onInput($event)"
        (blur)="onBlur()"
      />
      @if (showButtons()) {
        <div class="flex flex-col">
          <button
            type="button"
            tabindex="-1"
            aria-hidden="true"
            class="flex flex-1 items-center justify-center px-2 text-xs leading-none text-muted hover:bg-content-hover hover:text-text disabled:opacity-40 disabled:pointer-events-none"
            [disabled]="disabled() || atMax()"
            (click)="stepBy(1)"
          >
            <i class="ph ph-caret-up"></i>
          </button>
          <button
            type="button"
            tabindex="-1"
            aria-hidden="true"
            class="flex flex-1 items-center justify-center px-2 text-xs leading-none text-muted hover:bg-content-hover hover:text-text disabled:opacity-40 disabled:pointer-events-none"
            [disabled]="disabled() || atMin()"
            (click)="stepBy(-1)"
          >
            <i class="ph ph-caret-down"></i>
          </button>
        </div>
      }
    </div>
  `
})
export class LgInputNumber implements ControlValueAccessor {
  readonly inputId = input<string>();
  readonly showButtons = input(false, { transform: booleanAttribute });
  readonly min = input<number>();
  readonly max = input<number>();
  readonly step = input(1);
  readonly size = input<LgSize>();

  protected readonly value = signal<number | null>(null);
  protected readonly text = signal('');
  protected readonly disabled = signal(false);

  private onChange: (value: number) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  protected readonly wrapperClasses = computed(() =>
    [
      'inline-flex items-stretch overflow-hidden rounded-md border border-surface-300 bg-surface-0 text-text dark:border-surface-600 dark:bg-surface-950',
      'transition-colors duration-200 hover:border-surface-400 dark:hover:border-surface-500 focus-within:border-primary',
      this.disabled() ? 'opacity-60' : ''
    ]
      .filter(Boolean)
      .join(' ')
  );

  protected readonly fieldClasses = computed(() =>
    [
      'w-full min-w-0 bg-transparent outline-none placeholder:text-muted',
      controlPadding(this.size())
    ].join(' ')
  );

  protected readonly atMin = computed(() => {
    const min = this.min();
    const v = this.value();
    return min !== undefined && v !== null && v <= min;
  });

  protected readonly atMax = computed(() => {
    const max = this.max();
    const v = this.value();
    return max !== undefined && v !== null && v >= max;
  });

  protected onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.text.set(raw);
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed)) {
      this.value.set(parsed);
      this.onChange(parsed);
    }
  }

  protected stepBy(delta: number): void {
    if (this.disabled()) {
      return;
    }
    const base = this.value() ?? this.min() ?? 0;
    this.commit(this.clamp(base + delta * this.step()));
  }

  protected onBlur(): void {
    this.onTouched();
    const v = this.value();
    if (v !== null) {
      this.commit(this.clamp(v));
    }
  }

  private clamp(value: number): number {
    const min = this.min();
    const max = this.max();
    if (min !== undefined && value < min) {
      return min;
    }
    if (max !== undefined && value > max) {
      return max;
    }
    return value;
  }

  private commit(value: number): void {
    this.value.set(value);
    this.text.set(String(value));
    this.onChange(value);
  }

  writeValue(value: number): void {
    const n =
      typeof value === 'number' && Number.isFinite(value) ? value : null;
    this.value.set(n);
    this.text.set(n === null ? '' : String(n));
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }
}
