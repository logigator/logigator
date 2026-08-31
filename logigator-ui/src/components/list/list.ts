import { NgTemplateOutlet } from '@angular/common';
import { Component, contentChild, input, TemplateRef } from '@angular/core';
import { IconSlot } from '../../internal/icon';

/**
 * An enclosed list container: a bordered surface whose projected
 * {@link LgListItem} rows are separated by hairline dividers. `role="list"`
 * because Safari drops list semantics under the `list-style:none` reset.
 */
@Component({
  selector: 'lg-list',
  host: {
    role: 'list',
    class:
      'block overflow-hidden rounded-lg border border-border bg-content text-text'
  },
  template: '<ng-content></ng-content>'
})
export class LgList {}

/**
 * One row of an {@link LgList}, the projected default content being its title.
 * Optional `#leading` (winning over the `leadingIcon` shorthand), `#subtitle`
 * and `#trailing` slots enrich it; with none it is a plain single-line row.
 */
@Component({
  selector: 'lg-list-item',
  imports: [NgTemplateOutlet],
  host: {
    role: 'listitem',
    class:
      'flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0'
  },
  template: `
    @if (leading() || leadingIcon()) {
      <span class="inline-flex shrink-0 items-center text-lg text-muted">
        @if (leading()) {
          <ng-container [ngTemplateOutlet]="leading()!" />
        } @else {
          <i [class]="leadingIcon()" aria-hidden="true"></i>
        }
      </span>
    }
    <span class="min-w-0 flex-1">
      <span class="block truncate"><ng-content /></span>
      @if (subtitle()) {
        <span class="mt-0.5 block text-sm text-muted">
          <ng-container [ngTemplateOutlet]="subtitle()!" />
        </span>
      }
    </span>
    @if (trailing()) {
      <span class="shrink-0"
        ><ng-container [ngTemplateOutlet]="trailing()!"
      /></span>
    }
  `
})
export class LgListItem {
  /** Shorthand for a plain leading icon-font glyph (e.g. `"ph ph-file"`). */
  readonly leadingIcon = input<IconSlot>();

  protected readonly leading = contentChild<TemplateRef<unknown>>('leading');
  protected readonly subtitle = contentChild<TemplateRef<unknown>>('subtitle');
  protected readonly trailing = contentChild<TemplateRef<unknown>>('trailing');
}
