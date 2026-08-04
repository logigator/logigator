import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * An on/off switch. The interactive element is a `role="switch"` checkbox that
 * covers the whole control (so clicking the track toggles it) but is visually
 * hidden behind the track + handle skin; `inputId` lets an external
 * `<label for>` toggle it too.
 *
 * `ControlValueAccessor` (value = `boolean`) so template `ngModel` and reactive
 * forms both bind. Keyboard (space) works natively via the checkbox.
 */
@Component({
  selector: 'lg-toggle-switch',
  host: { class: 'relative inline-block h-6 w-10 shrink-0 align-middle' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => LgToggleSwitch),
      multi: true
    }
  ],
  template: `
    <input
      type="checkbox"
      role="switch"
      class="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
      [id]="inputId()"
      [checked]="checked()"
      [disabled]="disabled()"
      (change)="onChangeEvent($event)"
      (blur)="onTouched()"
    />
    <span
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 rounded-full bg-surface-300 transition-colors duration-200 peer-hover:bg-surface-400 dark:bg-surface-700 dark:peer-hover:bg-surface-600 peer-checked:bg-primary peer-checked:peer-hover:bg-primary-emphasis peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:opacity-60"
    ></span>
    <!-- 1rem handle, surface-0 in light; in dark it flips surface-400 →
         surface-900 with the checked state. -->
    <span
      aria-hidden="true"
      class="pointer-events-none absolute top-1 left-1 size-4 rounded-full bg-surface-0 transition-all duration-200 peer-checked:translate-x-4 dark:bg-surface-400 dark:peer-checked:bg-surface-900 peer-disabled:opacity-60"
    ></span>
  `
})
export class LgToggleSwitch implements ControlValueAccessor {
  readonly inputId = input<string>();

  protected readonly checked = signal(false);
  protected readonly disabled = signal(false);

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
    this.disabled.set(isDisabled);
  }
}
