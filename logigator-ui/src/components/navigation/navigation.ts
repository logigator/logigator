import { Component, effect, input, model, signal } from '@angular/core';
import { LgCollapse } from '../../internal/collapse';
import { NavigationItem } from './navigation-item.model';

const ROW =
  'flex w-full items-center gap-2 px-3 py-2 text-left ' +
  'hover:bg-content-hover disabled:pointer-events-none disabled:opacity-50';

/**
 * An inline navigation tree over selectable pages. Items with `items` render
 * as collapsible group headers, one nesting level deep; groups start expanded
 * and the group holding a newly selected leaf expands itself, so a collapsed
 * group never hides the selection.
 *
 * The visual sibling of {@link LgPanelMenu}, but stateful instead of
 * command-driven: pure {@link NavigationItem} data in, a two-way `selected`
 * binding out.
 */
@Component({
  selector: 'lg-navigation',
  host: { class: 'block' },
  imports: [LgCollapse],
  template: `
    @for (item of items(); track item.id) {
      @if (item.items?.length) {
        <button
          type="button"
          [class]="rowClass"
          class="font-semibold text-text"
          [attr.aria-expanded]="isExpanded(item.id)"
          (click)="toggle(item.id)"
        >
          @if (item.icon) {
            <i [class]="item.icon" aria-hidden="true"></i>
          }
          <span>{{ item.label }}</span>
          <i
            class="ph ph-caret-down ml-auto transition-transform duration-200"
            [class.rotate-180]="isExpanded(item.id)"
            aria-hidden="true"
          ></i>
        </button>
        <lg-collapse [open]="isExpanded(item.id)">
          @for (leaf of item.items; track leaf.id) {
            <button
              type="button"
              [class]="rowClass + ' pl-9 ' + leafClass(leaf.id)"
              [attr.aria-current]="selected() === leaf.id ? 'page' : null"
              (click)="select(leaf.id)"
            >
              @if (leaf.icon) {
                <i [class]="leaf.icon" aria-hidden="true"></i>
              }
              <span>{{ leaf.label }}</span>
            </button>
          }
        </lg-collapse>
      } @else {
        <button
          type="button"
          [class]="rowClass + ' ' + leafClass(item.id)"
          [attr.aria-current]="selected() === item.id ? 'page' : null"
          (click)="select(item.id)"
        >
          @if (item.icon) {
            <i [class]="item.icon" aria-hidden="true"></i>
          }
          <span>{{ item.label }}</span>
        </button>
      }
    }
  `
})
export class LgNavigation {
  readonly items = input<readonly NavigationItem[]>([]);
  /** Id of the selected leaf; two-way. */
  readonly selected = model<string | undefined>(undefined);

  protected readonly rowClass = ROW;
  private readonly collapsed = signal<ReadonlySet<string>>(new Set());

  constructor() {
    // A collapsed group re-expands when one of its leaves becomes selected,
    // so an outside jump to a page is never hidden.
    effect(() => {
      const selected = this.selected();
      if (selected === undefined) return;
      const group = this.items().find((item) =>
        item.items?.some((leaf) => leaf.id === selected)
      );
      if (group && this.collapsed().has(group.id)) {
        const next = new Set(this.collapsed());
        next.delete(group.id);
        this.collapsed.set(next);
      }
    });
  }

  protected isExpanded(id: string): boolean {
    return !this.collapsed().has(id);
  }

  protected toggle(id: string): void {
    const next = new Set(this.collapsed());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.collapsed.set(next);
  }

  protected select(id: string): void {
    this.selected.set(id);
  }

  protected leafClass(id: string): string {
    return this.selected() === id
      ? 'bg-content-hover font-medium text-primary'
      : 'text-text';
  }
}
