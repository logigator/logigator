import { Component, input } from '@angular/core';
import { ComponentSymbolShape } from '../../../components/component-config.model';

/**
 * Draws a palette tile's mini-shape for the built-ins whose canvas body is a
 * drawn shape rather than their symbol text — so the tile previews what placing
 * the component yields, the same way a gate's `&` tile does.
 *
 * The geometry belongs to each component's config ({@link
 * ComponentSymbolShape}); this only paints it, filling whatever box the host
 * gives it — the tile owns the size and the margin around the shape. Strokes are
 * `currentColor`: `non-scaling-stroke` holds them at a constant device width
 * whatever the tile scales to, as the canvas bodies are drawn at `PX` width, and
 * inheriting the colour is what makes the shapes track the active theme and
 * palette preset.
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
  /** The geometry to paint, from the component's config. */
  public shape = input.required<ComponentSymbolShape>();
}
