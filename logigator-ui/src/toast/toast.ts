import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { afterPaint } from '../internal/after-paint';
import { MessageService, ToastMessage } from './message.service';

/** The themed severities (`danger` is normalized to `error`). */
type ResolvedSeverity = 'success' | 'info' | 'warn' | 'error';

interface ActiveToast {
  id: number;
  severity: ResolvedSeverity;
  summary?: string;
  detail?: string;
  shown: boolean;
}

const SEVERITY_CLASS: Record<ResolvedSeverity, string> = {
  success: 'bg-success-surface text-success border-success-border',
  info: 'bg-info-surface text-info border-info-border',
  warn: 'bg-warn-surface text-warn border-warn-border',
  error: 'bg-error-surface text-error border-error-border'
};

const SEVERITY_ICON: Record<ResolvedSeverity, string> = {
  success: 'ph ph-check-circle',
  info: 'ph ph-info',
  warn: 'ph ph-warning',
  error: 'ph ph-x-circle'
};

const DEFAULT_LIFE = 3000;

/** The editor (and Aura) use `error`; map the invalid `danger` onto it. */
function resolveSeverity(severity?: string): ResolvedSeverity {
  if (severity === 'danger' || severity === 'error') {
    return 'error';
  }
  if (severity === 'warn' || severity === 'info' || severity === 'success') {
    return severity;
  }
  return 'info';
}

/**
 * The {@link MessageService} outlet: a fixed-position CSS stack of toasts (no
 * overlay). Each toast slides/fades in and auto-dismisses after its `life`. The
 * host carries the stack's position (corner from `position`); a consumer's own
 * `class` (e.g. `absolute! -mb-4`) merges and `!`-overrides as needed.
 */
@Component({
  selector: 'lg-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'pointer-events-none fixed z-[1100] flex flex-col gap-2 p-4',
    '[class.top-0]': 'atTop()',
    '[class.bottom-0]': '!atTop()',
    '[class.right-0]': 'atRight()',
    '[class.left-0]': '!atRight()',
    '[class.items-end]': 'atRight()',
    '[class.items-start]': '!atRight()'
  },
  template: `
    @for (toast of toasts(); track toast.id) {
      <div role="alert" [class]="toastClasses(toast)">
        <div class="flex items-start gap-2">
          <i
            [class]="severityIcon(toast.severity)"
            class="mt-0.5 text-lg"
            aria-hidden="true"
          ></i>
          <div class="min-w-0 flex-1">
            @if (toast.summary) {
              <p class="font-semibold">{{ toast.summary }}</p>
            }
            @if (toast.detail) {
              <p class="break-words text-sm">{{ toast.detail }}</p>
            }
          </div>
        </div>
      </div>
    }
  `
})
export class LgToast {
  readonly position = input<string>('bottom-left');

  protected readonly atTop = computed(() => this.position().startsWith('top'));
  protected readonly atRight = computed(() =>
    this.position().endsWith('right')
  );

  protected readonly toasts = signal<ActiveToast[]>([]);
  private nextId = 0;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  constructor() {
    inject(MessageService)
      .messageObserver.pipe(takeUntilDestroyed())
      .subscribe((message) => this.add(message));
    inject(DestroyRef).onDestroy(() => {
      this.timers.forEach((timer) => clearTimeout(timer));
      this.timers.clear();
    });
  }

  protected severityIcon(severity: ResolvedSeverity): string {
    return SEVERITY_ICON[severity];
  }

  protected toastClasses(toast: ActiveToast): string {
    return [
      'pointer-events-auto w-80 max-w-[80vw] rounded-md border p-3 shadow-lg',
      'transition-all duration-300',
      SEVERITY_CLASS[toast.severity],
      toast.shown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
    ].join(' ');
  }

  private add(message: ToastMessage): void {
    const id = ++this.nextId;
    this.toasts.update((list) => [
      ...list,
      {
        id,
        severity: resolveSeverity(message.severity),
        summary: message.summary,
        detail: message.detail,
        shown: false
      }
    ]);

    // Paint the off-screen "from" state first, then flip to play the enter.
    afterPaint(() => this.setShown(id));

    const timer = setTimeout(() => {
      this.timers.delete(timer);
      this.remove(id);
    }, message.life ?? DEFAULT_LIFE);
    this.timers.add(timer);
  }

  private setShown(id: number): void {
    this.toasts.update((list) =>
      list.map((toast) => (toast.id === id ? { ...toast, shown: true } : toast))
    );
  }

  private remove(id: number): void {
    this.toasts.update((list) => list.filter((toast) => toast.id !== id));
  }
}
