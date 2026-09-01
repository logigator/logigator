import {
  booleanAttribute,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output
} from '@angular/core';
import { IconSlot } from '../../internal/icon';
import { LgSeverity } from '../../tokens/severity';
import { LgSize } from '../../tokens/size';

type LgButtonVariant = 'solid' | 'outlined' | 'text';
type SeverityKey = 'primary' | LgSeverity;

// The host is the interactive element, so a consumer's own layout classes sit
// beside these. The border width lives here so every variant shares one box
// size; its color comes from the variant, since `border-transparent` would
// fight the outlined severities at stylesheet order. `disabled:` covers the
// native attribute, `aria-disabled:` the suppressed variant — which stays
// hoverable on purpose, so a tooltip explaining the disabled state still fires.
const BASE =
  'inline-flex items-center justify-center gap-2 border font-medium ' +
  'transition-colors duration-200 cursor-pointer select-none ' +
  'disabled:pointer-events-none disabled:opacity-60 focus:outline-none ' +
  'aria-disabled:opacity-60 aria-disabled:cursor-default ' +
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

// A floor plus padding, keyed by the `LgSize` scale. The floor is the height
// a one-line label produces at that step, so an icon on its own lands on a
// square of the same height and the two line up in a row. `min-*` rather than
// a fixed box: a label that wraps grows the button instead of spilling out of
// it.
const SIZE: Record<LgSize, string> = {
  sm: 'min-h-8.5 min-w-8.5 px-2 py-1.5 text-sm',
  md: 'min-h-10.5 min-w-10.5 px-3 py-2 text-base',
  lg: 'min-h-12.5 min-w-12.5 px-3.5 py-2.5 text-lg',
  xl: 'min-h-13.5 min-w-13.5 px-4 py-3 text-xl'
};

/** Drops the hover/active tokens a disabled control must not react with. */
function withoutInteractionStates(severity: string): string {
  return severity
    .split(' ')
    .filter((token) => !token.includes('hover:') && !token.includes('active:'))
    .join(' ');
}

/**
 * A button skin hosted on the real `<button>` or `<a>`, so `class`, `href`,
 * `routerLink` and the rest belong to the consumer. The projected content is
 * the label; an `icon` with nothing beside it renders as a square, and names
 * itself through `ariaLabel`.
 *
 * `disabled` sets the native attribute on a `<button>`; on an `<a>`, and
 * wherever `disabledInteractive` is set, it becomes `aria-disabled` with the
 * activation suppressed instead, which keeps the element hoverable so a
 * tooltip can explain why it is off.
 */
@Component({
  selector: 'button[lgButton], a[lgButton]',
  host: {
    '[class]': 'hostClasses()',
    '[attr.type]': 'typeAttr()',
    '[attr.disabled]': 'disabledAttr()',
    '[attr.aria-disabled]': 'ariaDisabledAttr()',
    '[attr.aria-label]': 'ariaLabel() ?? null',
    '(click)': 'handleClick($event)'
  },
  template: `
    @if (loading()) {
      <span
        class="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden="true"
      ></span>
    } @else if (icon()) {
      <i [class]="icon()" aria-hidden="true"></i>
    }
    <ng-content />
  `
})
export class LgButton {
  readonly icon = input<IconSlot>();
  readonly severity = input<LgSeverity>();
  readonly size = input<LgSize>();
  readonly text = input(false, { transform: booleanAttribute });
  readonly outlined = input(false, { transform: booleanAttribute });
  readonly rounded = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly loading = input(false, { transform: booleanAttribute });
  readonly disabledInteractive = input(false, { transform: booleanAttribute });
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly ariaLabel = input<string>();

  // On-prefixed output name; no-output-on-prefix is disabled for it.
  readonly onClick = output<MouseEvent>();

  private readonly isAnchor =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.tagName === 'A';

  protected readonly resolvedSize = computed(() => this.size() ?? 'md');

  private readonly inactive = computed(() => this.disabled() || this.loading());

  /** `disabled` an anchor cannot carry, and the opt-in hoverable variant. */
  private readonly suppressed = computed(
    () => this.inactive() && (this.isAnchor || this.disabledInteractive())
  );

  protected readonly typeAttr = computed(() =>
    this.isAnchor ? null : this.type()
  );

  protected readonly disabledAttr = computed(() =>
    this.inactive() && !this.suppressed() ? '' : null
  );

  protected readonly ariaDisabledAttr = computed(() =>
    this.suppressed() ? 'true' : null
  );

  protected readonly hostClasses = computed(() => {
    const variant: LgButtonVariant = this.text()
      ? 'text'
      : this.outlined()
        ? 'outlined'
        : 'solid';
    const severityKey: SeverityKey = this.severity() ?? 'primary';
    const severity = SEVERITY[variant][severityKey];
    return [
      BASE,
      variant === 'outlined' ? '' : 'border-transparent',
      this.rounded() ? 'rounded-4xl' : 'rounded-md',
      SIZE[this.resolvedSize()],
      this.inactive() ? withoutInteractionStates(severity) : severity
    ]
      .filter(Boolean)
      .join(' ');
  });

  // A host listener types `$event` as `Event`; a click always delivers a
  // `MouseEvent`, which is what the output carries.
  protected handleClick(event: Event): void {
    if (this.inactive()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    this.onClick.emit(event as MouseEvent);
  }
}
