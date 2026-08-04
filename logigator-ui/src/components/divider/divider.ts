import { Component, computed, input } from '@angular/core';

/**
 * A thin separator line. `layout="vertical"` draws a vertical rule (stretches
 * in a flex row); the default is a full-width horizontal rule. `variant="double"`
 * draws two parallel lines back-to-back with a small gap between them. The
 * divider owns no outer margin — callers space it themselves (e.g. `class="mx-1"`).
 */
@Component({
  selector: 'lg-divider',
  template: '',
  host: {
    role: 'separator',
    '[attr.aria-orientation]': 'layout()',
    '[class]': 'rootClass()'
  }
})
export class LgDivider {
  readonly layout = input<'horizontal' | 'vertical'>('horizontal');
  readonly variant = input<'single' | 'double'>('single');

  protected readonly rootClass = computed(() => {
    const vertical = this.layout() === 'vertical';
    if (this.variant() === 'double') {
      // Two lines are the box's own borders; the box height/width is the gap.
      return vertical
        ? 'inline-block w-1 self-stretch border-x border-border'
        : 'block h-1 w-full border-y border-border';
    }
    return vertical
      ? 'inline-block w-px self-stretch bg-border'
      : 'block h-px w-full bg-border';
  });
}
