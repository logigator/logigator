import {
  booleanAttribute,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  signal
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { IconSlot } from '../../internal/icon';
import { afterPaint } from '../../internal/after-paint';
import { lgLabel } from '../../tokens/labels';

/**
 * One tab in an {@link LgTabStrip}. `data` is an opaque payload echoed back on
 * `(selected)`/`(closed)` so the consumer maps a tab to its own model without
 * an index. `fixed` tabs pin to the front and never reorder or close.
 */
export interface LgTabStripItem<T = unknown> {
  data: T;
  label: string;
  /** Leading icon-font classes, e.g. `'ph ph-circuitry'`. */
  icon?: IconSlot;
  active?: boolean;
  dirty?: boolean;
  closable?: boolean;
  fixed?: boolean;
  ariaLabel?: string;
}

/** A reorder emitted by {@link LgTabStrip}, in the reorderable-tab index space. */
export interface LgTabReorder {
  previousIndex: number;
  currentIndex: number;
}

/**
 * Builds the live-region text for a keyboard reorder, given the 1-based
 * destination and the movable-tab count. A function rather than a template
 * string so the strip never has to define a placeholder syntax of its own —
 * the consumer's i18n layer does the interpolation it already knows how to do.
 */
export type LgMovedLabel = (position: number, total: number) => string;

/** English fallback when no `movedLabel` is supplied. */
const DEFAULT_MOVED: LgMovedLabel = (position, total) =>
  `Moved to position ${position} of ${total}`;

/**
 * A document/editor tab strip: a horizontal row of closable, reorderable tabs
 * (icon + label + dirty marker + ✕) — the browser/IDE tab pattern, distinct from
 * {@link LgTabs}, which shows and hides content panels. This component renders no
 * panels; selecting a tab is a signal the consumer acts on (e.g. swapping a
 * canvas).
 *
 * Tabs are supplied as data via `tabs`. Items marked `fixed` pin to the front
 * and never reorder or close; the rest sit in a horizontal CDK drop list and
 * emit `(reorder)` with indices in the reorderable subset. The drop list and its
 * drag items must share one view for CDK's DI-based container lookup to resolve,
 * so the strip is data-driven rather than content-projected. Set
 * `reorderDisabled` to freeze dragging (e.g. while a simulation is bound to the
 * active tab).
 *
 * Keyboard model — **manual activation**, unlike {@link LgTabs}: Left/Right and
 * Home/End move focus along the strip without switching tabs, and Enter/Space
 * activates the focused one. Activation-follows-focus would swap the consumer's
 * whole panel (in editor, the board and its project) on every arrow press.
 * Focus roves via `tabindex` so the strip is a single tab stop.
 *
 * Ctrl+Left/Right reorders the focused movable tab, the keyboard equivalent of
 * dragging it (WCAG 2.1.1); each move is announced through the strip's own
 * polite live region. Because the strip renders no panels, `aria-controls` is
 * opt-in: pass `controls` with the id of the region the consumer swaps.
 */
@Component({
  selector: 'lg-tab-strip',
  imports: [CdkDropList, CdkDrag, NgTemplateOutlet],
  host: { class: 'block' },
  template: `
    <div
      role="tablist"
      class="flex items-stretch bg-content-hover border-b border-border overflow-x-auto"
    >
      @for (tab of fixedTabs(); track tab.data; let i = $index) {
        <div
          role="tab"
          [class]="classes(tab)"
          [attr.tabindex]="tabIndexAt(i)"
          [attr.aria-selected]="!!tab.active"
          [attr.aria-label]="tab.ariaLabel ?? tab.label"
          [attr.aria-controls]="controls() ?? null"
          [title]="tab.label"
          (click)="onActivate(tab, i)"
          (keydown)="onKeydown($event, i)"
        >
          <ng-container
            [ngTemplateOutlet]="body"
            [ngTemplateOutletContext]="{ $implicit: tab }"
          />
        </div>
      }
      <div
        role="presentation"
        class="flex items-stretch"
        cdkDropList
        cdkDropListOrientation="horizontal"
        [cdkDropListDisabled]="reorderDisabled()"
        (cdkDropListDropped)="onDrop($event)"
      >
        @for (tab of movableTabs(); track tab.data; let i = $index) {
          <div
            cdkDrag
            cdkDragLockAxis="x"
            role="tab"
            [class]="classes(tab)"
            [attr.tabindex]="tabIndexAt(i + fixedTabs().length)"
            [attr.aria-selected]="!!tab.active"
            [attr.aria-label]="tab.ariaLabel ?? tab.label"
            [attr.aria-controls]="controls() ?? null"
            [title]="tab.label"
            (click)="onActivate(tab, i + fixedTabs().length)"
            (keydown)="onKeydown($event, i + fixedTabs().length)"
          >
            <ng-container
              [ngTemplateOutlet]="body"
              [ngTemplateOutletContext]="{ $implicit: tab }"
            />
          </div>
        }
      </div>
    </div>

    <!-- Reorder announcements. A persistent region, so a keyboard move is read
         out; the strip owns it because it owns the move. -->
    <div aria-live="polite" class="sr-only">{{ announcement() }}</div>

    <ng-template #body let-tab>
      @if (tab.icon) {
        <i [class]="iconClasses(tab)" aria-hidden="true"></i>
      }
      <span class="truncate max-w-56">{{ tab.label }}</span>
      @if (tab.closable) {
        <span class="inline-flex items-center justify-center shrink-0 w-4 h-4">
          @if (tab.dirty) {
            <span
              class="tab-dirty w-2 h-2 rounded-full bg-current opacity-60"
            ></span>
          }
          <button
            type="button"
            class="tab-close p-0.5 items-center justify-center rounded text-muted hover:text-error hover:bg-error-surface cursor-pointer"
            [attr.aria-label]="closeLabel()"
            (click)="onClose($event, tab)"
          >
            <i class="ph ph-x" aria-hidden="true"></i>
          </button>
        </span>
      } @else if (tab.dirty) {
        <span class="inline-flex items-center justify-center w-4 h-4 shrink-0">
          <span class="w-2 h-2 rounded-full bg-current opacity-60"></span>
        </span>
      }
    </ng-template>
  `,
  // The hover/touch swap of the dirty dot and ✕, plus CDK drag-drop polish.
  // CDK injects its classes onto the auto-generated placeholder and animating
  // siblings, so they cannot be expressed as template utility classes. The
  // drag items live in this view, so plain (encapsulated) selectors match them.
  styles: `
    .tab-close {
      display: none;
    }
    .tab:hover .tab-close,
    .tab:focus-within .tab-close {
      display: inline-flex;
    }
    .tab:hover .tab-dirty {
      display: none;
    }
    @media (hover: none) {
      .tab-close {
        display: inline-flex;
      }
      .tab-dirty {
        display: none;
      }
    }

    .cdk-drag-placeholder {
      opacity: 0;
    }
    .cdk-drag-animating,
    .cdk-drop-list-dragging .cdk-drag:not(.cdk-drag-placeholder) {
      transition: transform 180ms cubic-bezier(0, 0, 0.2, 1);
    }

    /*
     * CDK's cdk-resets cascade layer strips the dragged preview clone's
     * background, border, padding and color (leaving it transparent). These
     * rules are unlayered, so they win over that layer — and over the clone's
     * own (layered) utilities — restoring the tab surface per state via the
     * tab-active marker. The utilities the reset leaves alone (flex, gap,
     * height, font) still apply to the clone.
     */
    .cdk-drag-preview {
      padding: 0 0.75rem;
      background: var(--lg-content-hover);
      color: var(--lg-text);
      border-right: 1px solid var(--lg-border);
      border-top: 2px solid transparent;
    }
    .cdk-drag-preview.tab-active {
      background: var(--lg-content);
      border-top-color: var(--lg-primary);
    }
  `
})
export class LgTabStrip<T = unknown> {
  readonly tabs = input<LgTabStripItem<T>[]>([]);
  /** Freezes reordering (dragging and Ctrl+Arrow) of the non-fixed tabs. */
  readonly reorderDisabled = input(false, { transform: booleanAttribute });
  /** ARIA label for every close button. */
  readonly closeLabel = input(lgLabel('close'));
  /**
   * Id of the region the tabs govern, for `aria-controls`. The strip renders no
   * panels of its own, so the consumer names the element it swaps.
   */
  readonly controls = input<string>();
  /** Builds the live-region text for a keyboard reorder. */
  readonly movedLabel = input<LgMovedLabel>(DEFAULT_MOVED);

  readonly selected = output<T>();
  readonly closed = output<T>();
  /** Emits when a reorderable tab is dropped or moved to a new position. */
  readonly reorder = output<LgTabReorder>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly fixedTabs = computed(() =>
    this.tabs().filter((t) => t.fixed)
  );
  protected readonly movableTabs = computed(() =>
    this.tabs().filter((t) => !t.fixed)
  );

  /** Index of the active tab in strip order (fixed first), 0 when none is. */
  private readonly activeIndex = computed(() => {
    const index = [...this.fixedTabs(), ...this.movableTabs()].findIndex(
      (t) => t.active
    );
    return index < 0 ? 0 : index;
  });

  /**
   * The strip's single tab stop. Tracks the active tab, but an arrow key moves
   * it on its own (manual activation) — hence a `linkedSignal` rather than a
   * plain `computed`: a manual `set` survives until the active tab changes.
   */
  private readonly focusIndex = linkedSignal(() => this.activeIndex());

  protected readonly announcement = signal('');

  protected classes(tab: LgTabStripItem<T>): string {
    return [
      'tab flex items-center gap-2 h-8 px-3 text-sm whitespace-nowrap',
      'cursor-pointer select-none transition-colors border-r border-border border-t-2',
      // tab-active is a marker for the drag-preview restore rules below; the
      // visible styling comes from the utilities.
      tab.active
        ? 'tab-active bg-content text-text font-medium border-t-primary'
        : 'bg-content-hover text-muted border-t-transparent hover:text-text'
    ].join(' ');
  }

  protected iconClasses(tab: LgTabStripItem<T>): string {
    return `${tab.icon} text-base shrink-0${tab.active ? '' : ' opacity-70'}`;
  }

  /** `tabindex` for the tab at `index` in strip order — 0 for the tab stop. */
  protected tabIndexAt(index: number): number {
    const total = this.fixedTabs().length + this.movableTabs().length;
    // Clamp: the focused tab can be closed out from under the stored index.
    const focused = Math.min(this.focusIndex(), Math.max(total - 1, 0));
    return index === focused ? 0 : -1;
  }

  protected onActivate(tab: LgTabStripItem<T>, index: number): void {
    this.focusIndex.set(index);
    this.selected.emit(tab.data);
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    // Only the tab itself; the nested close button owns its own keys.
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const tab = [...this.fixedTabs(), ...this.movableTabs()][index];
      if (tab) {
        this.onActivate(tab, index);
      }
      return;
    }

    const horizontal = event.key === 'ArrowRight' || event.key === 'ArrowLeft';
    if (horizontal && (event.ctrlKey || event.metaKey)) {
      this.moveFocusedTab(event, index);
      return;
    }
    if (horizontal || event.key === 'Home' || event.key === 'End') {
      this.moveFocus(event, index);
    }
  }

  /** Arrow/Home/End roving. Moves focus only — activation stays explicit. */
  private moveFocus(event: KeyboardEvent, index: number): void {
    const total = this.fixedTabs().length + this.movableTabs().length;
    if (total === 0) {
      return;
    }
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = (index + 1) % total;
        break;
      case 'ArrowLeft':
        next = (index - 1 + total) % total;
        break;
      case 'Home':
        next = 0;
        break;
      default:
        next = total - 1;
    }
    event.preventDefault();
    this.focusIndex.set(next);
    this.focusTabAt(next);
  }

  /** Ctrl+Arrow reorder — the keyboard equivalent of a drag. */
  private moveFocusedTab(event: KeyboardEvent, index: number): void {
    if (this.reorderDisabled()) {
      return;
    }
    const movable = this.movableTabs();
    const from = index - this.fixedTabs().length;
    // Fixed tabs are pinned; they neither move nor displace a movable tab.
    if (from < 0) {
      return;
    }
    const to = event.key === 'ArrowRight' ? from + 1 : from - 1;
    if (to < 0 || to >= movable.length) {
      return;
    }
    event.preventDefault();
    this.reorder.emit({ previousIndex: from, currentIndex: to });
    this.announcement.set(this.movedLabel()(to + 1, movable.length));

    // The consumer owns the tab order, so the re-rendered strip is what carries
    // the tab to its new slot; follow it there once that has painted.
    const moved = to + this.fixedTabs().length;
    this.focusIndex.set(moved);
    afterPaint(() => this.focusTabAt(moved));
  }

  private focusTabAt(index: number): void {
    const tabs =
      this.host.nativeElement.querySelectorAll<HTMLElement>('[role=tab]');
    tabs.item(index)?.focus();
  }

  protected onDrop(event: CdkDragDrop<unknown>): void {
    this.reorder.emit({
      previousIndex: event.previousIndex,
      currentIndex: event.currentIndex
    });
  }

  protected onClose(event: Event, tab: LgTabStripItem<T>): void {
    // Keep the click from bubbling to the tab and selecting it.
    event.stopPropagation();
    this.closed.emit(tab.data);
  }
}
