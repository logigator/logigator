import {
  booleanAttribute,
  Component,
  computed,
  forwardRef,
  input,
  signal
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * A binary checkbox. A native checkbox covers the whole control and is hidden
 * behind the box + check-mark skin, so clicking anywhere toggles it, space
 * works natively, and `inputId` lets an external `<label for>` reach it. The
 * check mark is an inline SVG, keeping the library icon-agnostic.
 */
@Component({
  selector: 'lg-checkbox',
  host: { class: 'relative inline-block size-5 shrink-0 align-middle' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => LgCheckbox),
      multi: true
    }
  ],
  template: `
    <input
      type="checkbox"
      class="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
      [id]="inputId()"
      [checked]="checked()"
      [disabled]="isDisabled()"
      (change)="onChangeEvent($event)"
      (blur)="onTouched()"
    />
    <!-- Box: the form-field border/surface treatment, filling primary when
         checked (border included, so no halo between border and fill). -->
    <span
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 rounded-sm border bg-surface-0 dark:bg-surface-950 border-surface-300 dark:border-surface-600 shadow-xs transition-colors duration-200 peer-hover:border-surface-400 dark:peer-hover:border-surface-500 peer-checked:border-primary peer-checked:bg-primary peer-checked:peer-hover:border-primary-emphasis peer-checked:peer-hover:bg-primary-emphasis peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:opacity-60"
    ></span>
    <span
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 flex items-center justify-center text-primary-contrast opacity-0 transition-opacity duration-200 peer-checked:opacity-100 peer-checked:peer-disabled:opacity-60"
    >
      <svg viewBox="0 0 14 14" class="size-3" fill="none">
        <path
          d="M2.5 7.5 5.5 10.5 11.5 3.5"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>
  `
})
export class LgCheckbox implements ControlValueAccessor {
  readonly inputId = input<string>();
  /** Combined with the forms-driven disabled state. */
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly checked = signal(false);
  private readonly cvaDisabled = signal(false);
  protected readonly isDisabled = computed(
    () => this.disabled() || this.cvaDisabled()
  );

  private onChange: (value: boolean) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  protected onChangeEvent(event: Event): void {
    const value = (event.target as HTMLInputElement).checked;
    this.checked.set(value);
    this.onChange(value);
  }

  writeValue(value: boolean): void {
    this.checked.set(!!value);
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.cvaDisabled.set(isDisabled);
  }
}
