import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input
} from '@angular/core';
import { LgSeverity } from '../tokens/severity';

const BASE =
  'inline-flex items-center gap-1 px-2 py-1 text-sm font-bold leading-none';

// Subtle (tinted) treatment per severity, on the themeable surface/state palette.
const SEVERITY: Record<'primary' | LgSeverity, string> = {
  primary: 'bg-primary-100 text-primary-700',
  secondary: 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-200',
  info: 'bg-info-surface text-info',
  warn: 'bg-warn-surface text-warn',
  danger: 'bg-error-surface text-error'
};

/** A small status label. Subtle, tinted by `severity` (default primary). */
@Component({
  selector: 'lg-tag',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `<span [class]="classes()">{{ value() }}</span>`
})
export class LgTag {
  readonly value = input<string>();
  readonly severity = input<LgSeverity>();
  readonly rounded = input(false, { transform: booleanAttribute });

  protected readonly classes = computed(() =>
    [
      BASE,
      this.rounded() ? 'rounded-xl' : 'rounded-md',
      SEVERITY[this.severity() ?? 'primary']
    ].join(' ')
  );
}
