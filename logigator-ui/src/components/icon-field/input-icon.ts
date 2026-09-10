import { Component } from '@angular/core';

/**
 * A decorative icon inside an {@link LgIconField}. The glyph is a class string
 * on the host, e.g. `<lg-input-icon class="ph ph-magnifying-glass" />`;
 * {@link LgIconField} owns the absolute positioning over the input.
 */
@Component({
  selector: 'lg-input-icon',
  host: { class: 'text-surface-400', 'aria-hidden': 'true' },
  template: ''
})
export class LgInputIcon {}
