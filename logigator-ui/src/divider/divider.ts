import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input
} from '@angular/core';

/**
 * A thin separator line. `layout="vertical"` draws a vertical rule (stretches
 * in a flex row); the default is a full-width horizontal rule. The divider owns
 * no outer margin — callers space it themselves (e.g. `class="mx-1"`).
 */
@Component({
  selector: 'lg-divider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: {
    role: 'separator',
    '[attr.aria-orientation]': 'layout()',
    '[class]': 'rootClass()'
  }
})
export class LgDivider {
  readonly layout = input<'horizontal' | 'vertical'>('horizontal');

  protected readonly rootClass = computed(() =>
    this.layout() === 'vertical'
      ? 'inline-block w-px self-stretch bg-border'
      : 'block h-px w-full bg-border'
  );
}
