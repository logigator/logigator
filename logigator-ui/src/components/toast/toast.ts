import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { afterPaint } from '../../internal/after-paint';
import { LgButton } from '../button/button';
import { LgSeverity } from '../../tokens/severity';
import { ToastAction, ToastService, ToastMessage } from './toast.service';

interface ActiveToast {
  id: number;
  severity: LgSeverity;
  summary?: string;
  detail?: string;
  /** The offered follow-up, rendered as a button below the message. */
  action?: ToastAction;
  /** Whether the enter animation has been armed (`false` for one frame). */
  shown: boolean;
  /** Whether the leave animation is playing before the toast is removed. */
  leaving: boolean;
  /** Auto-dismiss delay in ms; `0` means the toast never times out. */
  life: number;
  /** Whether the countdown (and its progress bar) is currently frozen. */
  paused: boolean;
}

/** Non-reactive countdown bookkeeping, kept out of the rendered state. */
interface ToastTimer {
  handle: ReturnType<typeof setTimeout> | null;
  /** Milliseconds still to run when the timer was last (re)started. */
  remaining: number;
  /** `Date.now()` when the timer was last (re)started. */
  startedAt: number;
  hovered: boolean;
  focused: boolean;
}

// Toasts float over the arbitrary editor canvas, so they use the opaque
// `-surface-strong` fills rather than the translucent `-surface` tints, which
// would wash out and leave the text hard to read over some backgrounds.
const SEVERITY_CLASS: Record<LgSeverity, string> = {
  success: 'bg-success-surface-strong text-success border-success-border',
  info: 'bg-info-surface-strong text-info border-info-border',
  warn: 'bg-warn-surface-strong text-warn border-warn-border',
  danger: 'bg-error-surface-strong text-error border-error-border',
  none: 'bg-content text-muted border-border',
  secondary:
    'bg-surface-100 text-surface-700 border-surface-200 ' +
    'dark:bg-surface-800 dark:text-surface-200 dark:border-surface-700'
};

const SEVERITY_ICON: Record<LgSeverity, string> = {
  success: 'ph ph-check-circle',
  info: 'ph ph-info',
  warn: 'ph ph-warning',
  danger: 'ph ph-x-circle',
  none: 'ph ph-bell',
  secondary: 'ph ph-note'
};

const DEFAULT_LIFE = 3000;

/** How long the leave animation plays before the toast is removed (ms). */
const LEAVE_MS = 300;

/** Severity for a toast that arrives without one. */
const DEFAULT_SEVERITY: LgSeverity = 'info';

/**
 * The {@link ToastService} outlet: a fixed-position CSS stack of toasts (no
 * overlay). Each toast fades and slides in, rests while a progress bar drains
 * along its bottom edge to show the time left, then fades, shrinks and slides
 * out when its `life` runs out. Hovering the toast or moving keyboard focus into
 * it freezes both the countdown and its bar; an {@link LgButton} in the
 * top-right corner dismisses it immediately (also playing the leave animation).
 * A message carrying an `action` also renders a button below the text that runs
 * the handler and dismisses. The host carries the stack's position (corner from `position`); a consumer's
 * own `class` (e.g. `absolute! -mb-4`) merges and `!`-overrides as needed.
 *
 * With `embedded`, the host drops its own positioning (`fixed`, corner insets,
 * z-index, padding) and lives in normal flow, so a parent container owns
 * placement and stacking — e.g. a flex column where the toasts sit above
 * another overlay. It collapses to zero footprint when empty and lifts what
 * follows it by `mb-2` only while a toast is showing; `position` then only
 * picks the horizontal alignment.
 */
@Component({
  selector: 'lg-toast',
  imports: [LgButton],
  host: {
    class: 'pointer-events-none z-toast flex flex-col gap-2',
    '[class.fixed]': '!embedded()',
    '[class.p-4]': '!embedded()',
    '[class.top-0]': '!embedded() && atTop()',
    '[class.bottom-0]': '!embedded() && !atTop()',
    '[class.right-0]': '!embedded() && atRight()',
    '[class.left-0]': '!embedded() && !atRight()',
    '[class.items-end]': 'atRight()',
    '[class.items-start]': '!atRight()',
    '[class.mb-2]': 'embedded() && !!toasts().length'
  },
  template: `
    @for (toast of toasts(); track toast.id) {
      <div
        role="alert"
        [class]="toastClasses(toast)"
        (mouseenter)="setHovered(toast.id, true)"
        (mouseleave)="setHovered(toast.id, false)"
        (focusin)="setFocused(toast.id, true)"
        (focusout)="setFocused(toast.id, false)"
      >
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
          <lg-button
            text
            size="sm"
            icon="ph ph-x"
            ariaLabel="Dismiss"
            class="-mt-1 -mr-1 shrink-0"
            [severity]="toast.severity"
            (onClick)="close(toast.id)"
          />
        </div>
        @if (toast.action; as action) {
          <div class="mt-2 flex justify-end">
            <lg-button
              outlined
              size="sm"
              [label]="action.label"
              [severity]="toast.severity"
              (onClick)="runAction(toast.id)"
            />
          </div>
        }
        @if (toast.life > 0 && !toast.leaving) {
          <div
            class="lg-toast-progress pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-current opacity-40"
            [style.animationDuration.ms]="toast.life"
            [style.animationPlayState]="
              toast.shown && !toast.paused ? 'running' : 'paused'
            "
            aria-hidden="true"
          ></div>
        }
      </div>
    }
  `,
  styles: `
    .lg-toast-progress {
      transform-origin: left center;
      animation-name: lg-toast-progress;
      animation-timing-function: linear;
      animation-fill-mode: forwards;
    }
    @keyframes lg-toast-progress {
      from {
        transform: scaleX(1);
      }
      to {
        transform: scaleX(0);
      }
    }
  `
})
export class LgToast {
  readonly position = input<string>('bottom-left');
  readonly embedded = input<boolean>(false);

  protected readonly atTop = computed(() => this.position().startsWith('top'));
  protected readonly atRight = computed(() =>
    this.position().endsWith('right')
  );

  protected readonly toasts = signal<ActiveToast[]>([]);
  private nextId = 0;
  private readonly timers = new Map<number, ToastTimer>();
  private readonly leaveTimers = new Set<ReturnType<typeof setTimeout>>();

  constructor() {
    inject(ToastService)
      .messageObserver.pipe(takeUntilDestroyed())
      .subscribe((message) => this.add(message));
    inject(DestroyRef).onDestroy(() => {
      this.timers.forEach((timer) => {
        if (timer.handle !== null) {
          clearTimeout(timer.handle);
        }
      });
      this.timers.clear();
      this.leaveTimers.forEach((handle) => clearTimeout(handle));
      this.leaveTimers.clear();
    });
  }

  protected severityIcon(severity: LgSeverity): string {
    return SEVERITY_ICON[severity];
  }

  protected toastClasses(toast: ActiveToast): string {
    return [
      'pointer-events-auto relative w-80 max-w-[80vw] overflow-hidden rounded-md border p-3 shadow-lg backdrop-blur-md',
      'transition-all duration-300 ease-out',
      SEVERITY_CLASS[toast.severity],
      this.motionClasses(toast)
    ].join(' ');
  }

  /** The transform/opacity for a toast's lifecycle stage (enter / rest / leave). */
  private motionClasses(toast: ActiveToast): string {
    if (toast.leaving) {
      return `scale-95 opacity-0 ${this.atRight() ? 'translate-x-6' : '-translate-x-6'}`;
    }
    if (!toast.shown) {
      return `scale-95 opacity-0 ${this.atTop() ? '-translate-y-3' : 'translate-y-3'}`;
    }
    return 'translate-x-0 translate-y-0 scale-100 opacity-100';
  }

  /** Dismiss a toast by hand (the close button). */
  protected close(id: number): void {
    this.dismiss(id);
  }

  /** Run the offered follow-up, then dismiss the toast that offered it. */
  protected runAction(id: number): void {
    const toast = this.toasts().find((t) => t.id === id);
    if (!toast?.action || toast.leaving) {
      return;
    }
    this.dismiss(id);
    toast.action.handler();
  }

  protected setHovered(id: number, hovered: boolean): void {
    const timer = this.timers.get(id);
    if (!timer) {
      return;
    }
    timer.hovered = hovered;
    this.reconcile(id);
  }

  protected setFocused(id: number, focused: boolean): void {
    const timer = this.timers.get(id);
    if (!timer) {
      return;
    }
    timer.focused = focused;
    this.reconcile(id);
  }

  private add(message: ToastMessage): void {
    const id = ++this.nextId;
    const life = message.life ?? DEFAULT_LIFE;
    this.toasts.update((list) => [
      ...list,
      {
        id,
        severity: message.severity ?? DEFAULT_SEVERITY,
        summary: message.summary,
        detail: message.detail,
        action: message.action,
        shown: false,
        leaving: false,
        life,
        paused: false
      }
    ]);

    // Paint the off-screen "from" state first, then flip to play the enter.
    afterPaint(() => this.setShown(id));

    if (life > 0) {
      const timer: ToastTimer = {
        handle: null,
        remaining: life,
        startedAt: 0,
        hovered: false,
        focused: false
      };
      this.timers.set(id, timer);
      this.start(id, timer);
    }
  }

  /** Reconcile the countdown against hover/focus: pause while either holds. */
  private reconcile(id: number): void {
    const timer = this.timers.get(id);
    if (!timer) {
      return;
    }
    const shouldPause = timer.hovered || timer.focused;
    if (shouldPause && timer.handle !== null) {
      clearTimeout(timer.handle);
      timer.remaining = Math.max(
        0,
        timer.remaining - (Date.now() - timer.startedAt)
      );
      timer.handle = null;
      this.setPaused(id, true);
    } else if (!shouldPause && timer.handle === null) {
      this.start(id, timer);
      this.setPaused(id, false);
    }
  }

  private start(id: number, timer: ToastTimer): void {
    timer.startedAt = Date.now();
    timer.handle = setTimeout(() => this.dismiss(id), timer.remaining);
  }

  /** Stop the countdown, play the leave animation, then drop the toast. */
  private dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer?.handle != null) {
      clearTimeout(timer.handle);
    }
    this.timers.delete(id);

    let alreadyLeaving = true;
    this.toasts.update((list) =>
      list.map((toast) => {
        if (toast.id !== id || toast.leaving) {
          return toast;
        }
        alreadyLeaving = false;
        return { ...toast, leaving: true };
      })
    );
    if (alreadyLeaving) {
      return;
    }

    const handle = setTimeout(() => {
      this.leaveTimers.delete(handle);
      this.remove(id);
    }, LEAVE_MS);
    this.leaveTimers.add(handle);
  }

  private setShown(id: number): void {
    this.toasts.update((list) =>
      list.map((toast) => (toast.id === id ? { ...toast, shown: true } : toast))
    );
  }

  private setPaused(id: number, paused: boolean): void {
    this.toasts.update((list) =>
      list.map((toast) => (toast.id === id ? { ...toast, paused } : toast))
    );
  }

  private remove(id: number): void {
    this.toasts.update((list) => list.filter((toast) => toast.id !== id));
  }
}
