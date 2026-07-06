import { Component } from '@angular/core';

/**
 * A decorative icon placed inside an {@link LgIconField}. The icon glyph is
 * supplied by the consumer as a class string on the host (icon-agnostic), e.g.
 * `<lg-input-icon class="ph ph-magnifying-glass" />`. Coloured `surface-400`;
 * {@link LgIconField} owns its absolute positioning over the input.
 */
@Component({
  selector: 'lg-input-icon',
  host: { class: 'text-surface-400', 'aria-hidden': 'true' },
  template: ''
})
export class LgInputIcon {}
