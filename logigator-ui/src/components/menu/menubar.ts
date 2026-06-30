import { NgTemplateOutlet } from '@angular/common';
import { ConnectedPosition, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
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
import { createConnectedOverlay } from '../../internal/overlay';
import { MENU_ITEM_CLASS, MenuItem } from './menu-item.model';

/** Submenu drop positions: below/left-aligned, flipping up, then right-aligned. */
const SUBMENU_POSITIONS: ConnectedPosition[] = [
  {
    originX: 'start',
    originY: 'bottom',
    overlayX: 'start',
    overlayY: 'top',
    offsetY: 4
  },
  {
    originX: 'start',
    originY: 'top',
    overlayX: 'start',
    overlayY: 'bottom',
    offsetY: -4
  },
  {
    originX: 'end',
    originY: 'bottom',
    overlayX: 'end',
    overlayY: 'top',
    offsetY: 4
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
 * submenu item). The bar imposes no colour of its own (radius/padding are
 * internal); tint it by passing utility classes on the host.
 *
 * The submenu overlay deliberately has **no backdrop** so the other top-level
 * items stay hoverable/clickable; dismissal is a document `pointerdown` outside
 * the bar or the panel, plus Escape.
 */
@Component({
  selector: 'lg-menubar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  host: { class: 'flex items-center' },
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
              <span class="flex items-center gap-1 px-3 py-2">
                <span>{{ item.label }}</span>
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
        class="min-w-48 rounded-md border border-border bg-content py-1 shadow-lg focus:outline-none"
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
                    @if (sub.icon) {
                      <i [class]="sub.icon" aria-hidden="true"></i>
                    }
                    <span>{{ sub.label }}</span>
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
  private dismissAttached = false;
  private readonly onDocPointerDown = (event: Event): void => {
    const target = event.target as Node;
    if (this.host.nativeElement.contains(target)) {
      return;
    }
    if (this.overlayRef?.overlayElement.contains(target)) {
      return;
    }
    this.closeSubmenu();
  };

  protected topItemClass(active: boolean): string {
    return [
      'flex cursor-pointer items-center transition-colors focus:outline-none',
      'hover:bg-black/10 focus-visible:bg-black/10 dark:hover:bg-white/10 dark:focus-visible:bg-white/10',
      active ? 'bg-black/10 dark:bg-white/10' : ''
    ].join(' ');
  }

  protected onTopClick(i: number, item: MenuItem, event: Event): void {
    if (item.items?.length) {
      if (this.openIndex() === i) {
        this.closeSubmenu();
      } else {
        this.openSubmenu(i, item, event.currentTarget as HTMLElement);
      }
    } else {
      this.closeSubmenu();
      item.command?.({ item });
    }
  }

  protected onTopHover(i: number, event: Event): void {
    if (this.openIndex() < 0 || this.openIndex() === i) {
      return;
    }
    const item = this.model()[i];
    if (item?.items?.length) {
      this.openSubmenu(i, item, event.currentTarget as HTMLElement);
    } else {
      this.closeSubmenu();
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
        this.closeSubmenu();
        break;
    }
  }

  protected runSub(item: MenuItem): void {
    this.closeSubmenu();
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
    this.closeSubmenu();
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
    this.addDismissListener();
  }

  private closeSubmenu(): void {
    this.disposeOverlay();
    this.removeDismissListener();
    this.openIndex.set(-1);
    this.submenuItems.set([]);
  }

  private closeAndFocusTop(): void {
    const index = this.openIndex();
    this.closeSubmenu();
    this.topButton(index)?.focus();
  }

  private openFor(button: HTMLElement): void {
    const index = this.indexOf(button);
    const item = this.model()[index];
    if (item?.items?.length) {
      this.openSubmenu(index, item, button);
    } else {
      this.closeSubmenu();
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
