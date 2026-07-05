import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  TemplateRef
} from '@angular/core';

/**
 * A floating content panel. Projects an optional `#title` and `#subtitle`
 * template plus default body content. Consumer classes merge onto the host
 * (e.g. positioning a floating card).
 */
@Component({
  selector: 'lg-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  host: {
    class: 'block rounded-xl bg-content p-5 text-text shadow-sm'
  },
  template: `
    @if (titleTpl()) {
      <div class="mb-2 text-xl font-medium wrap-break-word">
        <ng-container [ngTemplateOutlet]="titleTpl()!" />
      </div>
    }
    @if (subtitleTpl()) {
      <div class="-mt-1 mb-3 text-muted wrap-break-word">
        <ng-container [ngTemplateOutlet]="subtitleTpl()!" />
      </div>
    }
    <ng-content />
  `
})
export class LgCard {
  protected readonly titleTpl = contentChild<TemplateRef<unknown>>('title');
  protected readonly subtitleTpl =
    contentChild<TemplateRef<unknown>>('subtitle');
}
