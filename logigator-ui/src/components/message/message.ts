import { booleanAttribute, Component, computed, input } from '@angular/core';
import { LgSeverity } from '../../tokens/severity';

// Full literal class strings so Tailwind's scanner keeps them.
const SEVERITY_CLASSES: Record<LgSeverity, string> = {
  none: 'border-transparent text-muted',
  secondary: 'border-border text-muted',
  info: 'border-info-border bg-info-surface text-info',
  success: 'border-success-border bg-success-surface text-success',
  warn: 'border-warn-border bg-warn-surface text-warn-text',
  danger: 'border-error-border bg-error-surface text-error'
};

const SEVERITY_ICONS: Record<LgSeverity, string> = {
  none: 'ph-warning-circle',
  secondary: 'ph-info',
  info: 'ph-info',
  success: 'ph-check-circle',
  warn: 'ph-warning',
  danger: 'ph-x-circle'
};

/**
 * Icon + message banner. Severity drives the colors, `none` rendering
 * borderless as a muted empty-state placeholder. Outer spacing is the
 * consumer's, via classes on the host.
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
