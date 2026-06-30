import { NgTemplateOutlet } from '@angular/common';
import {
  ConnectedPosition,
  Overlay,
  OverlayRef
} from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  contentChild,
  inject,
  input,
  OnDestroy,
  output,
  TemplateRef,
  ViewContainerRef,
  viewChild
} from '@angular/core';
import { Subscription } from 'rxjs';
import { createConnectedOverlay } from '../internal/overlay';
import { MenuItem } from './menu-item.model';

/**
 * Edge-aligned drop positions (the panel hugs an edge of the trigger, not its
 * centre) — below/right-aligned first, then below/left, then the upward flips.
 */
const MENU_POSITIONS: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  {
    originX: 'start',
    originY: 'bottom',
    overlayX: 'start',
    overlayY: 'top',
    offsetY: 4
  },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  {
    originX: 'start',
    originY: 'top',
    overlayX: 'start',
    overlayY: 'bottom',
    offsetY: -4
  }
];

/** The interactive wrapper for one menu row; the slot/default chrome fills it. */
const ITEM_CLASS =
  'flex w-full text-left text-text hover:bg-content-hover ' +
  'focus:bg-content-hover focus:outline-none ' +
  'disabled:pointer-events-none disabled:opacity-50';

/**
 * A popup menu over `cdk/overlay`. A trigger calls `toggle($event)` (anchors to
 * the event target) / `hide()`; `onShow`/`onHide` fire on open/close so the
 * trigger can reflect the open state. Renders an optional projected `#start`
 * block (large non-menu content) above the `model` items; each item uses the
 * `#item` slot (`$implicit` = the item) or default icon+label chrome. Items run
 * their `command` and close; dismisses on outside-click or Escape. Keyboard
 * focus roves the items with the arrow keys.
 */
@Component({
  selector: 'lg-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  template: `
    <ng-template #panel>
      <div
        role="menu"
        tabindex="-1"
        class="min-w-48 rounded-md border border-border bg-content py-1 shadow-lg focus:outline-none"
        (keydown)="onKeydown($event)"
      >
        @if (startTemplate(); as tpl) {
          <ng-container *ngTemplateOutlet="tpl"></ng-container>
        }
        @for (item of model(); track $index) {
          @if (item.visible !== false) {
            @if (item.separator) {
              <div class="my-1 border-t border-border"></div>
            } @else {
              <button
                type="button"
                role="menuitem"
                tabindex="-1"
                [class]="itemClass"
                [disabled]="item.disabled"
                (click)="run(item)"
              >
                @if (itemTemplate(); as tpl) {
                  <ng-container
                    *ngTemplateOutlet="tpl; context: { $implicit: item }"
                  ></ng-container>
                } @else {
                  <span class="flex w-full items-center gap-2 px-3 py-2">
                    @if (item.icon) {
                      <i [class]="item.icon" aria-hidden="true"></i>
                    }
                    <span>{{ item.label }}</span>
                  </span>
                }
              </button>
            }
          }
        }
      </div>
    </ng-template>
  `
})
export class LgMenu implements OnDestroy {
  readonly model = input<readonly MenuItem[]>([]);
  /** Popup-only; accepted for call-site parity. */
  readonly popup = input(true, { transform: booleanAttribute });
  readonly onShow = output<void>();
  readonly onHide = output<void>();

  protected readonly startTemplate =
    contentChild<TemplateRef<unknown>>('start');
  protected readonly itemTemplate = contentChild<TemplateRef<unknown>>('item');
  private readonly panel = viewChild.required<TemplateRef<unknown>>('panel');

  protected readonly itemClass = ITEM_CLASS;

  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);

  private overlayRef: OverlayRef | null = null;
  private subscriptions: Subscription | null = null;
  private trigger: HTMLElement | null = null;

  /** Open anchored to the event target, or close if already open. */
  toggle(event: Event): void {
    if (this.overlayRef) {
      this.hide();
      return;
    }
    this.open((event.currentTarget ?? event.target) as HTMLElement);
  }

  hide(): void {
    if (!this.overlayRef) {
      return;
    }
    this.disposeOverlay();
    this.onHide.emit();
  }

  ngOnDestroy(): void {
    this.disposeOverlay();
  }

  protected run(item: MenuItem): void {
    this.hide();
    item.command?.({ item });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.hide();
      this.trigger?.focus();
      return;
    }
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) {
      return;
    }
    const items = this.menuItems();
    if (!items.length) {
      return;
    }
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    let next = current;
    switch (event.key) {
      case 'ArrowDown':
        next = current < 0 ? 0 : (current + 1) % items.length;
        break;
      case 'ArrowUp':
        next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = items.length - 1;
        break;
    }
    items[next]?.focus();
  }

  private open(trigger: HTMLElement): void {
    this.trigger = trigger;
    this.overlayRef = createConnectedOverlay(this.overlay, {
      origin: trigger,
      positions: MENU_POSITIONS,
      hasBackdrop: true
    });
    this.overlayRef.attach(
      new TemplatePortal(this.panel(), this.viewContainerRef)
    );
    this.subscriptions = new Subscription();
    this.subscriptions.add(
      this.overlayRef.backdropClick().subscribe(() => this.hide())
    );
    this.onShow.emit();
    this.focusFirstItem();
  }

  private disposeOverlay(): void {
    this.subscriptions?.unsubscribe();
    this.subscriptions = null;
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }

  private menuItems(): HTMLElement[] {
    if (!this.overlayRef) {
      return [];
    }
    return Array.from(
      this.overlayRef.overlayElement.querySelectorAll<HTMLElement>(
        '[role=menuitem]:not([disabled])'
      )
    );
  }

  private focusFirstItem(): void {
    queueMicrotask(() => this.menuItems()[0]?.focus());
  }
}
