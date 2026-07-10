import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  isSignal,
  signal,
  ViewContainerRef,
  viewChild
} from '@angular/core';
import { WindowSize } from './window-config';
import { WindowRef } from './window-ref';
import { OpenWindow } from './window.service';
import { LgButton } from '../button/button';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Which window edges a resize drag moves. */
interface ResizeDirection {
  top?: boolean;
  right?: boolean;
  bottom?: boolean;
  left?: boolean;
}

const RESIZE_DIRECTIONS = {
  n: { top: true },
  s: { bottom: true },
  e: { right: true },
  w: { left: true },
  ne: { top: true, right: true },
  nw: { top: true, left: true },
  se: { bottom: true, right: true },
  sw: { bottom: true, left: true }
} satisfies Record<string, ResizeDirection>;

type ResizeHandle = keyof typeof RESIZE_DIRECTIONS;

const DEFAULT_SIZE: WindowSize = { width: 440, height: 360 };
const MIN_SIZE: WindowSize = { width: 240, height: 160 };
/** Offset of the first cascaded window from the outlet's top-left corner. */
const CASCADE_BASE = 16;
/** Step between consecutively cascaded windows. */
const CASCADE_STEP = 28;
/** Cascade positions wrap back to the base after this many windows. */
const CASCADE_WRAP = 8;

/**
 * The chrome of one floating window: title bar (drag-to-move, close button),
 * eight edge/corner resize zones, and the dynamically-created content
 * component. Move and resize run on captured pointer events, clamped to the
 * outlet's bounds — an unmeasured 0×0 bounds (e.g. before first paint) leaves
 * the window unclamped rather than collapsing it. Pressing the window raises
 * it; Escape closes it when `closable`.
 *
 * In `fullscreen` mode (set per outlet) the window fills the outlet instead:
 * no positioning, dragging, resizing, or window chrome — the title bar shows
 * a back button in place of the close ✕. Windows still stack by z-index, so
 * with several open only the topmost is visible and back reveals the one
 * beneath.
 *
 * The content is created in `ngAfterViewInit` — after `open()` has returned —
 * with `inputValues` applied before its first change detection, and can inject
 * {@link WindowRef} to close itself (mirroring the DynamicDialog container).
 */
@Component({
  selector: 'lg-window',
  host: {
    role: 'dialog',
    tabindex: '-1',
    '[attr.aria-label]': 'title()',
    class:
      'pointer-events-auto absolute flex flex-col bg-content text-text outline-none',
    '[class.rounded-lg]': '!fullscreen()',
    '[class.border]': '!fullscreen()',
    '[class.border-border]': '!fullscreen()',
    '[class.shadow-xl]': '!fullscreen()',
    '[class.inset-0]': 'fullscreen()',
    '[style.left.px]': 'fullscreen() ? null : rect().x',
    '[style.top.px]': 'fullscreen() ? null : rect().y',
    '[style.width.px]': 'fullscreen() ? null : rect().width',
    '[style.height.px]': 'fullscreen() ? null : rect().height',
    '[style.z-index]': 'entry().zIndex()',
    '(pointerdown)': 'raise()',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'endDrag($event)',
    '(pointercancel)': 'endDrag($event)',
    '(keydown.escape)': 'onEscape($event)'
  },
  imports: [LgButton],
  template: `
    <div
      class="flex shrink-0 touch-none items-center gap-2 border-b border-border px-3 py-1.5 select-none"
      [class.cursor-move]="!fullscreen()"
      (pointerdown)="beginMove($event)"
    >
      @if (fullscreen() && closable()) {
        <lg-button
          aria-label="Back"
          icon="ph ph-arrow-left"
          severity="none"
          size="sm"
          (click)="entry().ref.close()"
        ></lg-button>
      }
      @if (titleParts(); as parts) {
        <h2
          class="flex min-w-0 grow flex-wrap items-center gap-1 text-sm font-semibold text-text"
        >
          @for (part of parts; track $index; let last = $last) {
            @if (part.command; as command) {
              <!-- stopPropagation: a click must not begin a title-bar move. -->
              <button
                type="button"
                class="cursor-pointer truncate text-muted hover:text-text hover:underline"
                (pointerdown)="$event.stopPropagation()"
                (click)="command()"
              >
                {{ part.label }}
              </button>
            } @else {
              <span class="truncate">{{ part.label }}</span>
            }
            @if (!last) {
              <span class="text-muted">›</span>
            }
          }
        </h2>
      } @else {
        <h2 class="grow truncate text-sm font-semibold text-text">
          {{ title() }}
        </h2>
      }
      @if (closable() && !fullscreen()) {
        <lg-button
          aria-label="Close"
          icon="ph ph-x"
          severity="none"
          size="sm"
          (click)="entry().ref.close()"
        ></lg-button>
      }
    </div>
    <div class="min-h-0 grow overflow-auto" [class]="bodyClass()">
      <ng-container #contentHost></ng-container>
    </div>

    @if (!fullscreen()) {
      <!-- Resize zones. Corners come last so they win hit-testing over edges. -->
      <div
        class="absolute inset-x-2 top-0 h-1.5 cursor-ns-resize touch-none"
        (pointerdown)="beginResize($event, 'n')"
      ></div>
      <div
        class="absolute inset-x-2 bottom-0 h-1.5 cursor-ns-resize touch-none"
        (pointerdown)="beginResize($event, 's')"
      ></div>
      <div
        class="absolute inset-y-2 left-0 w-1.5 cursor-ew-resize touch-none"
        (pointerdown)="beginResize($event, 'w')"
      ></div>
      <div
        class="absolute inset-y-2 right-0 w-1.5 cursor-ew-resize touch-none"
        (pointerdown)="beginResize($event, 'e')"
      ></div>
      <div
        class="absolute top-0 left-0 size-2.5 cursor-nwse-resize touch-none"
        (pointerdown)="beginResize($event, 'nw')"
      ></div>
      <div
        class="absolute top-0 right-0 size-2.5 cursor-nesw-resize touch-none"
        (pointerdown)="beginResize($event, 'ne')"
      ></div>
      <div
        class="absolute bottom-0 left-0 size-2.5 cursor-nesw-resize touch-none"
        (pointerdown)="beginResize($event, 'sw')"
      ></div>
      <div
        class="absolute right-0 bottom-0 size-2.5 cursor-nwse-resize touch-none"
        (pointerdown)="beginResize($event, 'se')"
      ></div>
    }
  `
})
export class LgWindow implements AfterViewInit {
  readonly entry = input.required<OpenWindow>();
  /** The outlet's size; `0×0` means "not measured yet" and disables clamping. */
  readonly bounds = input.required<WindowSize>();
  /** Fill the outlet as a takeover instead of floating (set per outlet). */
  readonly fullscreen = input(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly contentHost = viewChild.required('contentHost', {
    read: ViewContainerRef
  });

  protected readonly title = computed(() => {
    const title = this.entry().config.title;
    return isSignal(title) ? title() : (title ?? '');
  });

  /** Structured title segments, or `null` to fall back to the plain title. */
  protected readonly titleParts = computed(() => {
    const parts = this.entry().config.titleParts?.();
    return parts && parts.length > 0 ? parts : null;
  });

  protected readonly closable = computed(
    () => this.entry().config.closable !== false
  );

  protected readonly bodyClass = computed(
    () => 'min-h-0 grow ' + (this.entry().config.bodyClass ?? 'p-3')
  );

  /** Rect set by move/resize drags; null until the first drag. */
  private readonly draggedRect = signal<Rect | null>(null);

  private readonly initialRect = computed<Rect>(() => {
    const { config, cascade } = this.entry();
    const size = config.initialSize ?? DEFAULT_SIZE;
    const offset = CASCADE_BASE + (cascade % CASCADE_WRAP) * CASCADE_STEP;
    const position = config.initialPosition ?? { x: offset, y: offset };
    return { ...position, ...size };
  });

  /** The rendered rect — the dragged (or initial) rect, kept inside bounds. */
  protected readonly rect = computed<Rect>(() =>
    this.clampRect(this.draggedRect() ?? this.initialRect())
  );

  /** In-flight move/resize drag; null while idle. */
  private drag: {
    pointerId: number;
    startX: number;
    startY: number;
    rect: Rect;
    direction: ResizeDirection | null;
  } | null = null;

  ngAfterViewInit(): void {
    const entry = this.entry();
    const injector = Injector.create({
      parent: this.injector,
      providers: [{ provide: WindowRef, useValue: entry.ref }]
    });
    const componentRef = this.contentHost().createComponent(entry.component, {
      injector
    });
    const inputs = entry.config.inputValues;
    if (inputs) {
      for (const [key, value] of Object.entries(inputs)) {
        componentRef.setInput(key, value);
      }
    }
    entry.ref.notifyChildLoaded(componentRef.instance);
  }

  /** Raise the window and move keyboard focus into it (for Escape-to-close). */
  protected raise(): void {
    this.entry().ref.focus();
    if (!this.host.nativeElement.contains(document.activeElement)) {
      this.host.nativeElement.focus({ preventScroll: true });
    }
  }

  protected onEscape(event: Event): void {
    if (!this.closable()) {
      return;
    }
    event.stopPropagation();
    this.entry().ref.close();
  }

  protected beginMove(event: PointerEvent): void {
    if (this.fullscreen() || (event.target as HTMLElement).closest('button')) {
      return;
    }
    this.beginDrag(event, null);
  }

  protected beginResize(event: PointerEvent, handle: ResizeHandle): void {
    this.beginDrag(event, RESIZE_DIRECTIONS[handle]);
  }

  private beginDrag(
    event: PointerEvent,
    direction: ResizeDirection | null
  ): void {
    this.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      rect: this.rect(),
      direction
    };
    this.host.nativeElement.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.drag || event.pointerId !== this.drag.pointerId) {
      return;
    }
    const dx = event.clientX - this.drag.startX;
    const dy = event.clientY - this.drag.startY;
    if (this.drag.direction) {
      this.applyResize(this.drag.rect, this.drag.direction, dx, dy);
    } else {
      this.draggedRect.set(
        this.clampRect({
          ...this.drag.rect,
          x: this.drag.rect.x + dx,
          y: this.drag.rect.y + dy
        })
      );
    }
  }

  protected endDrag(event: PointerEvent): void {
    if (!this.drag || event.pointerId !== this.drag.pointerId) {
      return;
    }
    this.drag = null;
    this.host.nativeElement.releasePointerCapture?.(event.pointerId);
  }

  /** Moves the dragged edges, anchoring the opposite ones. */
  private applyResize(
    start: Rect,
    direction: ResizeDirection,
    dx: number,
    dy: number
  ): void {
    const bounds = this.bounds();
    const { minSize, maxSize } = this.sizeLimits();
    let left = start.x;
    let top = start.y;
    let right = start.x + start.width;
    let bottom = start.y + start.height;

    if (direction.left) {
      left = start.x + dx;
      if (bounds.width > 0) {
        left = Math.max(left, 0);
      }
      left = clamp(left, right - maxSize.width, right - minSize.width);
    }
    if (direction.right) {
      right = start.x + start.width + dx;
      if (bounds.width > 0) {
        right = Math.min(right, bounds.width);
      }
      right = clamp(right, left + minSize.width, left + maxSize.width);
    }
    if (direction.top) {
      top = start.y + dy;
      if (bounds.height > 0) {
        top = Math.max(top, 0);
      }
      top = clamp(top, bottom - maxSize.height, bottom - minSize.height);
    }
    if (direction.bottom) {
      bottom = start.y + start.height + dy;
      if (bounds.height > 0) {
        bottom = Math.min(bottom, bounds.height);
      }
      bottom = clamp(bottom, top + minSize.height, top + maxSize.height);
    }

    const next: Rect = {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top
    };
    const previous = this.rect();
    this.draggedRect.set(next);
    if (next.width !== previous.width || next.height !== previous.height) {
      this.entry().ref.notifyResized({
        width: next.width,
        height: next.height
      });
    }
  }

  private sizeLimits(): { minSize: WindowSize; maxSize: WindowSize } {
    const config = this.entry().config;
    return {
      minSize: config.minSize ?? MIN_SIZE,
      maxSize: config.maxSize ?? { width: Infinity, height: Infinity }
    };
  }

  /** Keeps the rect inside the outlet, shrinking it if the outlet is smaller. */
  private clampRect(rect: Rect): Rect {
    const bounds = this.bounds();
    const { minSize, maxSize } = this.sizeLimits();
    let width = clamp(rect.width, minSize.width, maxSize.width);
    let height = clamp(rect.height, minSize.height, maxSize.height);
    let x = Math.max(rect.x, 0);
    let y = Math.max(rect.y, 0);
    if (bounds.width > 0) {
      width = Math.min(width, bounds.width);
      x = clamp(x, 0, bounds.width - width);
    }
    if (bounds.height > 0) {
      height = Math.min(height, bounds.height);
      y = clamp(y, 0, bounds.height - height);
    }
    return { x, y, width, height };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
