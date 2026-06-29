import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  forwardRef,
  inject,
  input,
  signal,
  viewChild
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * A single-handle horizontal slider. `ControlValueAccessor` (value = `number`).
 * Pointer drag and keyboard (arrows step by `step`, Home/End jump to the
 * bounds) both move it; `role="slider"` + `aria-value*` keep it accessible.
 * Single handle only — no range/dual-handle, vertical, or custom animation.
 */
@Component({
  selector: 'lg-slider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block w-full cursor-pointer touch-none select-none py-2',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerUp($event)'
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => LgSlider),
      multi: true
    }
  ],
  template: `
    <div
      class="relative h-1.5 w-full rounded-full bg-surface-200 dark:bg-surface-700"
    >
      <div
        class="absolute inset-y-0 left-0 rounded-full bg-primary"
        [style.width.%]="percent()"
      ></div>
      <div
        #handle
        role="slider"
        [attr.tabindex]="disabled() ? -1 : 0"
        [attr.aria-valuemin]="min()"
        [attr.aria-valuemax]="max()"
        [attr.aria-valuenow]="value()"
        [attr.aria-disabled]="disabled() || null"
        class="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        [style.left.%]="percent()"
        (keydown)="onKeydown($event)"
        (blur)="onTouched()"
      ></div>
    </div>
  `
})
export class LgSlider implements ControlValueAccessor {
  readonly min = input(0);
  readonly max = input(100);
  readonly step = input(1);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly handle =
    viewChild.required<ElementRef<HTMLElement>>('handle');

  protected readonly value = signal(0);
  protected readonly disabled = signal(false);
  private dragging = false;

  private onChange: (value: number) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  protected readonly percent = computed(() => {
    const span = this.max() - this.min();
    if (span <= 0) {
      return 0;
    }
    const ratio = (this.value() - this.min()) / span;
    return Math.min(100, Math.max(0, ratio * 100));
  });

  protected onPointerDown(event: PointerEvent): void {
    if (this.disabled()) {
      return;
    }
    this.dragging = true;
    this.host.nativeElement.setPointerCapture(event.pointerId);
    this.handle().nativeElement.focus();
    this.commit(this.valueFromClientX(event.clientX));
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.dragging) {
      return;
    }
    this.commit(this.valueFromClientX(event.clientX));
  }

  protected onPointerUp(event: PointerEvent): void {
    if (!this.dragging) {
      return;
    }
    this.dragging = false;
    this.host.nativeElement.releasePointerCapture(event.pointerId);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.disabled()) {
      return;
    }
    let next: number | undefined;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = this.value() + this.step();
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = this.value() - this.step();
        break;
      case 'Home':
        next = this.min();
        break;
      case 'End':
        next = this.max();
        break;
      default:
        return;
    }
    event.preventDefault();
    this.commit(this.clampAndStep(next));
  }

  private valueFromClientX(clientX: number): number {
    const rect = this.host.nativeElement.getBoundingClientRect();
    const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    return this.clampAndStep(this.min() + ratio * (this.max() - this.min()));
  }

  private clampAndStep(value: number): number {
    const step = this.step() || 1;
    const stepped = this.min() + Math.round((value - this.min()) / step) * step;
    return Math.min(this.max(), Math.max(this.min(), stepped));
  }

  private commit(value: number): void {
    if (value === this.value()) {
      return;
    }
    this.value.set(value);
    this.onChange(value);
  }

  writeValue(value: number): void {
    if (typeof value === 'number' && Number.isFinite(value)) {
      this.value.set(value);
    }
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
