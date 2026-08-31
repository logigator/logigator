import {
  booleanAttribute,
  Component,
  computed,
  input,
  output
} from '@angular/core';
import { IconSlot } from '../../internal/icon';
import { LgSeverity } from '../../tokens/severity';
import { controlPadding, LgSize } from '../../tokens/size';

type LgButtonVariant = 'solid' | 'outlined' | 'text';
type SeverityKey = 'primary' | LgSeverity;

// The inner button fills the host box, so a layout class on `<lg-button>`
// sizes the button too. The border width lives here so every variant shares
// one box size; its color comes from the variant, since `border-transparent`
// would fight the outlined severities at stylesheet order.
const BASE =
  'inline-flex size-full items-center justify-center gap-2 border font-medium ' +
  'transition-colors duration-200 cursor-pointer select-none ' +
  'disabled:pointer-events-none disabled:opacity-60 focus:outline-none ' +
  'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-current';

// primary/secondary track the themeable primary/surface scales, the state
// severities the semantic palette, and none is a chromeless neutral.
const SEVERITY: Record<LgButtonVariant, Record<SeverityKey, string>> = {
  solid: {
    primary:
      'bg-primary text-primary-contrast hover:bg-primary-emphasis active:bg-primary-emphasis-alt',
    none: 'text-muted hover:bg-surface-100 active:bg-surface-200 dark:hover:bg-surface-800 dark:active:bg-surface-700',
    secondary:
      'bg-surface-100 text-surface-600 hover:bg-surface-200 hover:text-surface-700 ' +
      'active:bg-surface-300 active:text-surface-800 ' +
      'dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700 dark:hover:text-surface-200 ' +
      'dark:active:bg-surface-600 dark:active:text-surface-100',
    info: 'bg-info text-white hover:brightness-95 active:brightness-90',
    success:
      'bg-success text-white dark:text-surface-950 hover:brightness-95 active:brightness-90',
    warn: 'bg-warn text-surface-950 hover:brightness-95 active:brightness-90',
    danger: 'bg-error text-white hover:brightness-95 active:brightness-90'
  },
  outlined: {
    primary:
      'text-primary border-primary-200 hover:bg-primary-50 active:bg-primary-100 ' +
      'dark:border-primary-700 dark:hover:bg-primary/4 dark:active:bg-primary/16',
    none: 'text-muted border-border hover:bg-surface-50 active:bg-surface-100 dark:hover:bg-surface-800 dark:active:bg-surface-700',
    secondary:
      'text-surface-500 border-surface-200 hover:bg-surface-50 active:bg-surface-100 ' +
      'dark:text-surface-400 dark:border-surface-700 dark:hover:bg-white/4 dark:active:bg-white/16',
    info: 'text-info border-info hover:bg-info/10 active:bg-info/20',
    success:
      'text-success border-success hover:bg-success/10 active:bg-success/20',
    warn: 'text-warn-text border-warn-text hover:bg-warn/10 active:bg-warn/20',
    danger: 'text-error border-error hover:bg-error/10 active:bg-error/20'
  },
  text: {
    primary:
      'text-primary hover:bg-primary-50 active:bg-primary-100 dark:hover:bg-primary/4 dark:active:bg-primary/16',
    none: 'text-muted hover:bg-surface-50 active:bg-surface-100 dark:hover:bg-surface-800 dark:active:bg-surface-700',
    secondary:
      'text-surface-500 hover:bg-surface-50 active:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800 dark:active:bg-surface-700',
    info: 'text-info hover:bg-info/10 active:bg-info/20',
    success: 'text-success hover:bg-success/10 active:bg-success/20',
    warn: 'text-warn-text hover:bg-warn/10 active:bg-warn/20',
    danger: 'text-error hover:bg-error/10 active:bg-error/20'
  }
};

/** Icon-only glyph text size, keyed by the same `LgSize` scale. */
const ICON_ONLY_TEXT: Record<LgSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl'
};

/**
 * A native `<button>` skin. Omit `label` for an icon-only button. Layout
 * classes go on the host and the inner button fills it; `styleClass` merges
 * onto that inner `<button>` beside the variant/severity classes.
 */
@Component({
  selector: 'lg-button',
  host: {
    class: 'inline-flex',
    '[class.size-8]': 'iconOnly() && resolvedSize() === "sm"',
    '[class.size-10]': 'iconOnly() && resolvedSize() === "md"',
    '[class.size-12]': 'iconOnly() && resolvedSize() === "lg"',
    '[class.size-14]': 'iconOnly() && resolvedSize() === "xl"'
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
  readonly styleClass = input<string>('');

  // On-prefixed output name; no-output-on-prefix is disabled for it.
  readonly onClick = output<MouseEvent>();

  protected readonly hasLabel = computed(() => {
    const l = this.label();
    return l !== undefined && l !== '';
  });

  protected readonly iconOnly = computed(() => !this.hasLabel());

  protected readonly resolvedSize = computed(() => this.size() ?? 'md');

  protected readonly buttonClasses = computed(() => {
    const variant: LgButtonVariant = this.text()
      ? 'text'
      : this.outlined()
        ? 'outlined'
        : 'solid';
    const severityKey: SeverityKey = this.severity() ?? 'primary';
    // The host carries icon-only square sizing, so only the text size is
    // needed here; a labelled button gets the shared padding instead.
    const sizing = this.iconOnly()
      ? ICON_ONLY_TEXT[this.resolvedSize()]
      : controlPadding(this.size());
    return [
      BASE,
      variant === 'outlined' ? '' : 'border-transparent',
      this.rounded() ? 'rounded-4xl' : 'rounded-md',
      sizing,
      SEVERITY[variant][severityKey],
      this.styleClass()
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
