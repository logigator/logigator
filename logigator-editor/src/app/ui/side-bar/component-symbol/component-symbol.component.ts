import { Component, input } from '@angular/core';
import { ComponentSymbolShape } from '../../../components/component-config.model';

/**
 * Draws a palette tile's mini-shape for the built-ins whose canvas body is a
 * drawn shape rather than their symbol text, so the tile previews what placing
 * the component yields.
 *
 * The geometry belongs to each component's config; this only paints it into
 * whatever box the host gives it. Strokes are `currentColor` with
 * `non-scaling-stroke`: inheriting the colour tracks the active theme and
 * palette preset, and the constant device width matches the canvas bodies,
 * which are drawn at `PX` width.
 */
@Component({
  selector: 'app-component-symbol',
  host: { class: 'block' },
  template: `<svg
    class="block w-full h-full"
    viewBox="0 0 18 18"
    aria-hidden="true"
  >
    @if (shape().fill; as d) {
      <path
        class="[vector-effect:non-scaling-stroke]"
        [attr.d]="d"
        fill="currentColor"
      />
    }
    @if (shape().stroke; as d) {
      <path
        class="[vector-effect:non-scaling-stroke]"
        [attr.d]="d"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      />
    }
  </svg>`
})
export class ComponentSymbolComponent {
  public shape = input.required<ComponentSymbolShape>();
}
