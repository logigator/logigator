import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output
} from '@angular/core';
import { IconSlot } from '../internal/icon';
import { LgSeverity } from '../tokens/severity';
import { controlPadding, LgSize } from '../tokens/size';

type LgButtonVariant = 'solid' | 'outlined' | 'text';
type SeverityKey = 'primary' | LgSeverity;

// The inner button fills the host box (`size-full`) so any layout class the
// caller puts on `<lg-button>` (e.g. `class="w-full"`) sizes the button too;
// icon-only square sizing lives on the host (see the `size-*` host bindings).
const BASE =
  'inline-flex size-full items-center justify-center gap-2 border border-transparent font-medium ' +
  'transition-colors duration-200 cursor-pointer select-none ' +
  'disabled:pointer-events-none disabled:opacity-60 focus:outline-none ' +
  'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-current';

// Severity → class table. primary/secondary track the themeable primary/surface
// scales (an exact match for Aura); info/warn/danger use the semantic state
// palette (a deliberate, themeable consolidation of Aura's button-specific
// sky/orange/red — flagged for the Phase 8 visual pass).
const SEVERITY: Record<LgButtonVariant, Record<SeverityKey, string>> = {
  solid: {
    primary:
      'bg-primary text-primary-contrast hover:bg-primary-emphasis active:bg-primary-emphasis-alt',
    secondary:
      'bg-surface-100 text-surface-600 hover:bg-surface-200 active:bg-surface-300 ' +
      'dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700 dark:active:bg-surface-600',
    info: 'bg-info text-white hover:brightness-95 active:brightness-90',
    warn: 'bg-warn text-white hover:brightness-95 active:brightness-90',
    danger: 'bg-error text-white hover:brightness-95 active:brightness-90'
  },
  outlined: {
    primary:
      'text-primary border-primary-200 hover:bg-primary-50 active:bg-primary-100 dark:border-primary-700',
    secondary:
      'text-surface-500 border-surface-200 hover:bg-surface-50 active:bg-surface-100 ' +
      'dark:text-surface-400 dark:border-surface-700',
    info: 'text-info border-info hover:bg-info/10 active:bg-info/20',
    warn: 'text-warn border-warn hover:bg-warn/10 active:bg-warn/20',
    danger: 'text-error border-error hover:bg-error/10 active:bg-error/20'
  },
  text: {
    primary:
      'text-primary hover:bg-primary-50 active:bg-primary-100 dark:hover:bg-surface-800',
    secondary:
      'text-surface-500 hover:bg-surface-50 active:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800',
    info: 'text-info hover:bg-info/10 active:bg-info/20',
    warn: 'text-warn hover:bg-warn/10 active:bg-warn/20',
    danger: 'text-error hover:bg-error/10 active:bg-error/20'
  }
};

/**
 * A native `<button>` skin. Mirrors the slice of PrimeNG's `p-button` API the
 * editor uses: `label` (omit for an icon-only button), `icon` (an icon-font
 * class string), `severity`, `size`, `text`/`outlined`/`rounded`, `disabled`,
 * `loading`, `type`, and `ariaLabel`. Emits `onClick` (kept on the `on` prefix
 * to match PrimeNG's event name). Layout classes go on the host (`<lg-button
 * class="w-full">`); the inner button fills it.
 */
@Component({
  selector: 'lg-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex',
    '[class.size-8]': 'iconOnly() && size() === "small"',
    '[class.size-10]': 'iconOnly() && size() !== "small"'
  },
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [attr.aria-label]="ariaLabel() ?? null"
      [class]="buttonClasses()"
      (click)="handleClick($event)"
    >
      @if (loading()) {
        <span
          class="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        ></span>
      } @else if (icon()) {
        <i [class]="icon()" aria-hidden="true"></i>
      }
      @if (hasLabel()) {
        <span>{{ label() }}</span>
      }
    </button>
  `
})
export class LgButton {
  readonly label = input<string>();
  readonly icon = input<IconSlot>();
  readonly severity = input<LgSeverity>();
  readonly size = input<LgSize>();
  readonly text = input(false, { transform: booleanAttribute });
  readonly outlined = input(false, { transform: booleanAttribute });
  readonly rounded = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly loading = input(false, { transform: booleanAttribute });
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly ariaLabel = input<string>();

  // Named `onClick` to match PrimeNG's event (see no-output-on-prefix off).
  readonly onClick = output<MouseEvent>();

  protected readonly hasLabel = computed(() => {
    const l = this.label();
    return l !== undefined && l !== '';
  });

  protected readonly iconOnly = computed(() => !this.hasLabel());

  protected readonly buttonClasses = computed(() => {
    const variant: LgButtonVariant = this.text()
      ? 'text'
      : this.outlined()
        ? 'outlined'
        : 'solid';
    const severityKey: SeverityKey = this.severity() ?? 'primary';
    // Icon-only square sizing comes from the host; here the icon-only button
    // only needs its text size, while a labelled button gets the shared padding.
    const sizing = this.iconOnly()
      ? this.size() === 'small'
        ? 'text-sm'
        : 'text-base'
      : controlPadding(this.size());
    return [
      BASE,
      this.rounded() ? 'rounded-4xl' : 'rounded-md',
      sizing,
      SEVERITY[variant][severityKey]
    ]
      .filter(Boolean)
      .join(' ');
  });

  protected handleClick(event: MouseEvent): void {
    if (this.disabled() || this.loading()) {
      return;
    }
    this.onClick.emit(event);
  }
}
