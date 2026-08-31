import { Component, computed, input } from '@angular/core';

/**
 * A thin separator line: a full-width horizontal rule, or a vertical one that
 * stretches in a flex row. `variant="double"` draws two parallel lines. It
 * owns no outer margin, so callers space it themselves.
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
