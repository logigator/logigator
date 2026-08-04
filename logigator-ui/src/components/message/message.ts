import { booleanAttribute, Component, computed, input } from '@angular/core';
import { LgSeverity } from '../../tokens/severity';

/**
 * Border/background/text classes per severity. `none` is borderless with muted
 * text — an empty-state placeholder rather than a tinted banner; `secondary` is
 * a bordered neutral banner. `danger` renders the red `error-*` palette. Written
 * as full literal class strings so Tailwind's scanner keeps them.
 */
const SEVERITY_CLASSES: Record<LgSeverity, string> = {
  none: 'border-transparent text-muted',
  secondary: 'border-border text-muted',
  info: 'border-info-border bg-info-surface text-info',
  success: 'border-success-border bg-success-surface text-success',
  warn: 'border-warn-border bg-warn-surface text-warn-text',
  danger: 'border-error-border bg-error-surface text-error'
};

/** Default Phosphor icon per severity, overridable via the `icon` input. */
const SEVERITY_ICONS: Record<LgSeverity, string> = {
  none: 'ph-warning-circle',
  secondary: 'ph-info',
  info: 'ph-info',
  success: 'ph-check-circle',
  warn: 'ph-warning',
  danger: 'ph-x-circle'
};

/**
 * Icon + message banner. Severity drives the border/background/text colors;
 * `none` renders borderless as a muted empty-state placeholder. Set `centered`
 * to stack the icon above centered text (e.g. a tab-filling placeholder)
 * instead of the default left-aligned row. The message is projected; outer
 * spacing is left to the consumer via the host element's classes.
 */
@Component({
  selector: 'lg-message',
  template: `
    <div
      class="flex gap-3 rounded-lg border px-4 py-3 {{ containerClasses() }}"
    >
      <i class="ph shrink-0 {{ iconSizeClass() }} {{ iconClass() }}"></i>
      <p><ng-content /></p>
    </div>
  `,
  host: {
    class: 'block'
  }
})
export class LgMessage {
  /** Visual severity; `none` (default) renders borderless with muted text. */
  readonly severity = input<LgSeverity>('none');
  /** Stack the icon above centered text instead of a left-aligned row. */
  readonly centered = input(false, { transform: booleanAttribute });
  /** Phosphor icon class; defaults to a per-severity icon. */
  readonly icon = input<string>();

  protected readonly containerClasses = computed(
    () =>
      `${SEVERITY_CLASSES[this.severity()]} ${
        this.centered() ? 'flex-col items-center text-center' : 'items-center'
      }`
  );
  protected readonly iconClass = computed(
    () => this.icon() ?? SEVERITY_ICONS[this.severity()]
  );
  protected readonly iconSizeClass = computed(() =>
    this.centered() ? 'text-3xl' : 'text-xl'
  );
}
