import { booleanAttribute, Component, computed, input } from '@angular/core';
import { LgSeverity } from '../../tokens/severity';

const BASE =
  'inline-flex h-6 min-w-6 items-center justify-center gap-1 px-2 text-xs font-bold leading-none';

// Solid (filled) treatment per severity, on the themeable primary/surface/state
// palette. Tag and Badge map secondary differently — encoded separately.
const SEVERITY: Record<'primary' | LgSeverity, string> = {
  primary: 'bg-primary text-primary-contrast',
  none: 'bg-transparent text-muted',
  secondary:
    'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300',
  info: 'bg-info text-white',
  success: 'bg-success text-white',
  warn: 'bg-warn text-white',
  danger: 'bg-error text-white'
};

/**
 * A small count/label pill. Its content is projected, so it can hold plain text,
 * a number, or an icon + label. `rounded` makes it a full pill (default rounded-md).
 */
@Component({
  selector: 'lg-badge',
  host: { class: 'inline-flex' },
  template: `<span [class]="classes()"><ng-content /></span>`
})
export class LgBadge {
  readonly severity = input<LgSeverity>();
  readonly rounded = input(false, { transform: booleanAttribute });

  protected readonly classes = computed(() =>
    [
      BASE,
      this.rounded() ? 'rounded-full' : 'rounded-md',
      SEVERITY[this.severity() ?? 'primary']
    ].join(' ')
  );
}
