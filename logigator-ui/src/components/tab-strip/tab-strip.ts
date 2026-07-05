import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { IconSlot } from '../../internal/icon';

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
 */
@Component({
  selector: 'lg-tab-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropList, CdkDrag, NgTemplateOutlet],
  host: { class: 'block' },
  template: `
    <div
      role="tablist"
      class="flex items-stretch bg-content-hover border-b border-border overflow-x-auto"
    >
      @for (tab of fixedTabs(); track tab.data) {
        <div
          role="tab"
          tabindex="0"
          [class]="classes(tab)"
          [attr.aria-selected]="!!tab.active"
          [attr.aria-label]="tab.ariaLabel ?? tab.label"
          [title]="tab.label"
          (click)="selected.emit(tab.data)"
          (keydown.enter)="selected.emit(tab.data)"
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
        @for (tab of movableTabs(); track tab.data) {
          <div
            cdkDrag
            cdkDragLockAxis="x"
            role="tab"
            tabindex="0"
            [class]="classes(tab)"
            [attr.aria-selected]="!!tab.active"
            [attr.aria-label]="tab.ariaLabel ?? tab.label"
            [title]="tab.label"
            (click)="selected.emit(tab.data)"
            (keydown.enter)="selected.emit(tab.data)"
          >
            <ng-container
              [ngTemplateOutlet]="body"
              [ngTemplateOutletContext]="{ $implicit: tab }"
            />
          </div>
        }
      </div>
    </div>

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
            (keydown.enter)="onClose($event, tab)"
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
  /** Freezes reordering (dragging) of the non-fixed tabs. */
  readonly reorderDisabled = input(false, { transform: booleanAttribute });
  /** ARIA label for every close button. */
  readonly closeLabel = input('Close');

  readonly selected = output<T>();
  readonly closed = output<T>();
  /** Emits when a reorderable tab is dropped in a new position. */
  readonly reorder = output<LgTabReorder>();

  protected readonly fixedTabs = computed(() =>
    this.tabs().filter((t) => t.fixed)
  );
  protected readonly movableTabs = computed(() =>
    this.tabs().filter((t) => !t.fixed)
  );

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
