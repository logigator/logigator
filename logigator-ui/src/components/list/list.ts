import { NgTemplateOutlet } from '@angular/common';
import { Component, contentChild, input, TemplateRef } from '@angular/core';
import { IconSlot } from '../../internal/icon';

/**
 * An enclosed list container: a bordered, rounded surface whose rows are
 * separated by hairline dividers. Projects any number of {@link LgListItem}
 * children. Carries `role="list"` so the list semantics survive the
 * `list-style:none` reset (Safari drops them otherwise); items carry
 * `role="listitem"`.
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
 * One row of an {@link LgList}. Projected default content is the row title;
 * three optional template slots enrich it:
 *
 * - `#leading` — a leading icon/graphic, muted by default. `leadingIcon` is a
 *   shorthand for a plain glyph without a template; a `#leading` template wins.
 * - `#subtitle` — a muted supporting line under the title (e.g. "last edited").
 * - `#trailing` — trailing content pinned to the row's end (tag, badge, button).
 *
 * With no slots filled it's a plain single-line row. A bottom divider separates
 * rows; the last row drops it (`last:border-b-0`).
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
