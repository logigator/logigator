import { NgTemplateOutlet } from '@angular/common';
import { ConnectedPosition, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  Component,
  contentChild,
  ElementRef,
  inject,
  input,
  OnDestroy,
  signal,
  TemplateRef,
  ViewContainerRef,
  viewChild
} from '@angular/core';
import { LgFadeIn } from '../../internal/fade-in';
import { createConnectedOverlay } from '../../internal/overlay';
import { LgRipple } from '../ripple/ripple';
import { LgShortcut } from '../shortcut/shortcut';
import { MENU_ITEM_CLASS, MenuItem } from './menu-item.model';

/**
 * Submenu drop positions: flush below/left-aligned (the panel hugs the bar,
 * like PrimeNG's menubar), flipping up, then right-aligned.
 */
const SUBMENU_POSITIONS: ConnectedPosition[] = [
  {
    originX: 'start',
    originY: 'bottom',
    overlayX: 'start',
    overlayY: 'top'
  },
  {
    originX: 'start',
    originY: 'top',
    overlayX: 'start',
    overlayY: 'bottom'
  },
  {
    originX: 'end',
    originY: 'bottom',
    overlayX: 'end',
    overlayY: 'top'
  }
];

/**
 * A horizontal menu bar with **one** level of pop-up submenu. `model` is the
 * top-level `MenuItem[]`; items with `items` open a submenu on click (and switch
 * on hover while a submenu is already open), leaf items run their `command`.
 *
 * Three optional content slots — `#start` / `#end` (free content pinned to the
 * bar's leading / trailing edge) and `#item` (each menu row, context
 * `{ $implicit: item, root }` where `root` distinguishes a top-level item from a
 * submenu item). The default rows render the label, the item's `shortcut` as
 * {@link LgShortcut} chips, and a caret on top-level parents — item icons are a
 * custom-`#item` concern. The bar imposes no colour of its own (radius/padding
 * are internal); tint it by passing utility classes on the host.
 *
 * The submenu overlay deliberately has **no backdrop** so the other top-level
 * items stay hoverable/clickable. While a submenu is open the bar is *armed*:
 * hovering another parent switches panels, and hovering a leaf closes the panel
 * but keeps the bar armed so the next parent opens on hover again. Dismissal —
 * a `pointerdown` outside the item strip and the panel (projected `#start`/
 * `#end` content counts as outside), Escape, or running a command — disarms.
 */
@Component({
  selector: 'lg-menubar',
  imports: [NgTemplateOutlet, LgFadeIn, LgRipple, LgShortcut],
  host: { class: 'flex items-center gap-2 p-1' },
  template: `
    @if (startTemplate(); as tpl) {
      <ng-container *ngTemplateOutlet="tpl"></ng-container>
    }

    <div role="menubar" class="flex items-center">
      @for (item of model(); track $index; let i = $index) {
        @if (item.visible !== false) {
          <button
            type="button"
            role="menuitem"
            tabindex="-1"
            lgRipple
            [attr.data-index]="i"
            [attr.aria-haspopup]="item.items?.length ? 'menu' : null"
            [attr.aria-expanded]="item.items?.length ? openIndex() === i : null"
            [class]="topItemClass(openIndex() === i)"
            (click)="onTopClick(i, item, $event)"
            (mouseenter)="onTopHover(i, $event)"
            (keydown)="onTopKeydown(i, item, $event)"
          >
            @if (itemTemplate(); as tpl) {
              <ng-container
                *ngTemplateOutlet="
                  tpl;
                  context: { $implicit: item, root: true }
                "
              ></ng-container>
            } @else {
              <span class="flex items-center gap-2 px-3 py-2">
                <span class="mr-auto">{{ item.label }}</span>
                @if (item.shortcut) {
                  <lg-shortcut class="pl-4" [binding]="item.shortcut" />
                }
                @if (item.items?.length) {
                  <i class="ph ph-caret-down" aria-hidden="true"></i>
                }
              </span>
            }
          </button>
        }
      }
    </div>

    @if (endTemplate(); as tpl) {
      <div class="ml-auto">
        <ng-container *ngTemplateOutlet="tpl"></ng-container>
      </div>
    }

    <ng-template #submenu>
      <div
        role="menu"
        tabindex="-1"
        lgFadeIn
        class="min-w-48 rounded-md border border-border bg-content p-1 shadow-md focus:outline-none"
        (keydown)="onSubmenuKeydown($event)"
      >
        @for (sub of submenuItems(); track $index) {
          @if (sub.visible !== false) {
            @if (sub.separator) {
              <div class="my-1 border-t border-border"></div>
            } @else {
              <button
                type="button"
                role="menuitem"
                tabindex="-1"
                lgRipple
                [class]="itemClass"
                [disabled]="sub.disabled"
                (click)="runSub(sub)"
              >
                @if (itemTemplate(); as tpl) {
                  <ng-container
                    *ngTemplateOutlet="
                      tpl;
                      context: { $implicit: sub, root: false }
                    "
                  ></ng-container>
                } @else {
                  <span class="flex w-full items-center gap-2 px-3 py-2">
                    <span class="mr-auto">{{ sub.label }}</span>
                    @if (sub.shortcut) {
                      <lg-shortcut class="pl-4" [binding]="sub.shortcut" />
                    }
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
export class LgMenubar implements OnDestroy {
  readonly model = input<readonly MenuItem[]>([]);

  protected readonly startTemplate =
    contentChild<TemplateRef<unknown>>('start');
  protected readonly endTemplate = contentChild<TemplateRef<unknown>>('end');
  protected readonly itemTemplate = contentChild<TemplateRef<unknown>>('item');
  private readonly submenu =
    viewChild.required<TemplateRef<unknown>>('submenu');

  protected readonly itemClass = MENU_ITEM_CLASS;
  protected readonly openIndex = signal(-1);
  protected readonly submenuItems = signal<readonly MenuItem[]>([]);

  private readonly overlay = inject(Overlay);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly viewContainerRef = inject(ViewContainerRef);

  private overlayRef: OverlayRef | null = null;
  private armed = false;
  private dismissAttached = false;
  private readonly onDocPointerDown = (event: Event): void => {
    const target = event.target as Node;
    const strip = this.host.nativeElement.querySelector('[role=menubar]');
    if (strip?.contains(target)) {
      return;
    }
    if (this.overlayRef?.overlayElement.contains(target)) {
      return;
    }
    this.dismiss();
  };

  protected topItemClass(active: boolean): string {
    return [
      'flex cursor-pointer items-center rounded-md transition-colors focus:outline-none',
      'hover:bg-content-hover hover:text-text focus-visible:bg-content-hover focus-visible:text-text',
      active ? 'bg-content-hover text-text' : ''
    ].join(' ');
  }

  protected onTopClick(i: number, item: MenuItem, event: Event): void {
    if (item.items?.length) {
      if (this.openIndex() === i) {
        this.dismiss();
      } else {
        this.openSubmenu(i, item, event.currentTarget as HTMLElement);
      }
    } else {
      this.dismiss();
      item.command?.({ item });
    }
  }

  protected onTopHover(i: number, event: Event): void {
    if (!this.armed || this.openIndex() === i) {
      return;
    }
    const item = this.model()[i];
    if (item?.items?.length) {
      this.openSubmenu(i, item, event.currentTarget as HTMLElement);
    } else {
      // A leaf closes the open panel but keeps the bar armed, so the next
      // parent item opens on hover again.
      this.closeOverlay();
    }
  }

  protected onTopKeydown(
    i: number,
    item: MenuItem,
    event: KeyboardEvent
  ): void {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowLeft': {
        const tops = this.topButtons();
        const pos = tops.findIndex((b) => this.indexOf(b) === i);
        if (pos < 0) {
          return;
        }
        event.preventDefault();
        const dir = event.key === 'ArrowRight' ? 1 : -1;
        const next = tops[(pos + dir + tops.length) % tops.length];
        next.focus();
        if (this.openIndex() >= 0) {
          this.openFor(next);
        }
        break;
      }
      case 'ArrowDown':
        if (item.items?.length) {
          event.preventDefault();
          this.openSubmenu(i, item, event.currentTarget as HTMLElement);
          this.focusFirstSubmenuItem();
        }
        break;
      case 'Escape':
        this.dismiss();
        break;
    }
  }

  protected runSub(item: MenuItem): void {
    this.dismiss();
    item.command?.({ item });
  }

  protected onSubmenuKeydown(event: KeyboardEvent): void {
    // A nested control that already handled (and preventDefaulted) the key
    // shouldn't also drive submenu roving.
    if (event.defaultPrevented) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeAndFocusTop();
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const tops = this.topButtons();
      const pos = tops.findIndex((b) => this.indexOf(b) === this.openIndex());
      if (pos < 0) {
        return;
      }
      event.preventDefault();
      const dir = event.key === 'ArrowRight' ? 1 : -1;
      const next = tops[(pos + dir + tops.length) % tops.length];
      next.focus();
      this.openFor(next);
      this.focusFirstSubmenuItem();
      return;
    }
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) {
      return;
    }
    const items = this.submenuButtons();
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
        next =
          current < 0
            ? items.length - 1
            : (current - 1 + items.length) % items.length;
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

  ngOnDestroy(): void {
    this.dismiss();
  }

  private openSubmenu(i: number, item: MenuItem, anchor: HTMLElement): void {
    this.disposeOverlay();
    this.submenuItems.set(item.items ?? []);
    this.openIndex.set(i);
    this.overlayRef = createConnectedOverlay(this.overlay, {
      origin: anchor,
      positions: SUBMENU_POSITIONS
    });
    this.overlayRef.attach(
      new TemplatePortal(this.submenu(), this.viewContainerRef)
    );
    this.armed = true;
    this.addDismissListener();
  }

  /** Close the open panel but stay armed (leaf hovers / arrow roving). */
  private closeOverlay(): void {
    this.disposeOverlay();
    this.openIndex.set(-1);
    this.submenuItems.set([]);
  }

  /** Close the open panel and leave menu mode. */
  private dismiss(): void {
    this.closeOverlay();
    this.armed = false;
    this.removeDismissListener();
  }

  private closeAndFocusTop(): void {
    const index = this.openIndex();
    this.dismiss();
    this.topButton(index)?.focus();
  }

  private openFor(button: HTMLElement): void {
    const index = this.indexOf(button);
    const item = this.model()[index];
    if (item?.items?.length) {
      this.openSubmenu(index, item, button);
    } else {
      this.closeOverlay();
    }
  }

  private disposeOverlay(): void {
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }

  private addDismissListener(): void {
    if (this.dismissAttached) {
      return;
    }
    document.addEventListener('pointerdown', this.onDocPointerDown, true);
    this.dismissAttached = true;
  }

  private removeDismissListener(): void {
    if (!this.dismissAttached) {
      return;
    }
    document.removeEventListener('pointerdown', this.onDocPointerDown, true);
    this.dismissAttached = false;
  }

  private indexOf(button: HTMLElement): number {
    return Number(button.dataset['index']);
  }

  private topButtons(): HTMLElement[] {
    return Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>(
        '[role=menubar] > [role=menuitem]'
      )
    );
  }

  private topButton(index: number): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>(
      `[role=menubar] > [role=menuitem][data-index="${index}"]`
    );
  }

  private submenuButtons(): HTMLElement[] {
    if (!this.overlayRef) {
      return [];
    }
    return Array.from(
      this.overlayRef.overlayElement.querySelectorAll<HTMLElement>(
        '[role=menuitem]:not([disabled])'
      )
    );
  }

  private focusFirstSubmenuItem(): void {
    queueMicrotask(() => this.submenuButtons()[0]?.focus());
  }
}
