import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input
} from '@angular/core';

export type MessageSeverity = 'none' | 'info' | 'warn' | 'success' | 'error';

/**
 * Border/background/text classes per severity. `none` is borderless with muted
 * text — an empty-state placeholder rather than a tinted banner. Written as full
 * literal class strings so Tailwind's scanner keeps them.
 */
const SEVERITY_CLASSES: Record<MessageSeverity, string> = {
  none: 'border-transparent text-surface-500',
  info: 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-400',
  warn: 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400',
  success:
    'border-green-200 bg-green-50 text-green-600 dark:border-green-900 dark:bg-green-950/40 dark:text-green-400',
  error:
    'border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400'
};

/** Default Phosphor icon per severity, overridable via the `icon` input. */
const SEVERITY_ICONS: Record<MessageSeverity, string> = {
  none: 'ph-warning-circle',
  info: 'ph-info',
  warn: 'ph-warning',
  success: 'ph-check-circle',
  error: 'ph-x-circle'
};

/**
 * Icon + message banner. Severity drives the border/background/text colors;
 * `none` renders borderless as a muted empty-state placeholder. Set `centered`
 * to stack the icon above centered text (e.g. a tab-filling placeholder)
 * instead of the default left-aligned row. The message is projected; outer
 * spacing is left to the consumer via the host element's classes.
 */
@Component({
  selector: 'app-message',
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
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MessageComponent {
  /** Visual severity; `none` renders borderless with muted text. */
  readonly severity = input<MessageSeverity>('none');
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
