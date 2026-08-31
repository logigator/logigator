import { Component, input, signal } from '@angular/core';
import { LgCollapse } from '../../internal/collapse';
import { MenuItem } from '../menu/menu-item.model';
import { LgDivider } from '../divider/divider';

const ROW =
  'flex w-full items-center gap-2 px-3 py-2 text-left text-text ' +
  'hover:bg-content-hover disabled:pointer-events-none disabled:opacity-50';

/**
 * An inline, overlay-less menu rendered as a one-level accordion. The only
 * menu surface rendering the default item chrome rather than an `#item`
 * template.
 */
@Component({
  selector: 'lg-panel-menu',
  host: { class: 'block' },
  imports: [LgCollapse, LgDivider],
  template: `
    @for (item of model(); track $index; let i = $index) {
      @if (item.visible !== false) {
        @if (item.separator) {
          <lg-divider class="my-1"></lg-divider>
        } @else if (item.items?.length) {
          <button
            type="button"
            [class]="rowClass"
            [attr.aria-expanded]="isExpanded(i)"
            (click)="toggle(i)"
          >
            @if (item.icon) {
              <i [class]="item.icon" aria-hidden="true"></i>
            }
            <span>{{ item.label }}</span>
            <i
              class="ph ph-caret-down ml-auto transition-transform duration-200"
              [class.rotate-180]="isExpanded(i)"
              aria-hidden="true"
            ></i>
          </button>
          <lg-collapse [open]="isExpanded(i)">
            @for (sub of item.items; track $index) {
              @if (sub.visible !== false) {
                @if (sub.separator) {
                  <lg-divider class="my-1"></lg-divider>
                } @else {
                  <button
                    type="button"
                    [class]="rowClass + ' pl-9'"
                    [disabled]="sub.disabled"
                    (click)="run(sub)"
                  >
                    @if (sub.icon) {
                      <i [class]="sub.icon" aria-hidden="true"></i>
                    }
                    <span>{{ sub.label }}</span>
                  </button>
                }
              }
            }
          </lg-collapse>
        } @else {
          <button
            type="button"
            [class]="rowClass"
            [disabled]="item.disabled"
            (click)="run(item)"
          >
            @if (item.icon) {
              <i [class]="item.icon" aria-hidden="true"></i>
            }
            <span>{{ item.label }}</span>
          </button>
        }
      }
    }
  `
})
export class LgPanelMenu {
  readonly model = input<readonly MenuItem[]>([]);

  protected readonly rowClass = ROW;
  private readonly expanded = signal<ReadonlySet<number>>(new Set());

  protected isExpanded(index: number): boolean {
    return this.expanded().has(index);
  }

  protected toggle(index: number): void {
    const next = new Set(this.expanded());
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    this.expanded.set(next);
  }

  protected run(item: MenuItem): void {
    item.command?.({ item });
  }
}
