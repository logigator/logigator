import { ThemingService } from '../theming/theming.service';
import { getStaticDI } from '../utils/get-di';

/** The tint contract shared by components, wires and junction dots. */
export interface InvalidTintable {
  tint: number;
  refreshTint(): void;
}

/**
 * Tints an element with the theme's invalid color, or restores its own tint.
 * The elements are tinted directly rather than through a parent container: a
 * container tint multiplies with the children's own tints (wires carry their
 * color AS tint over a white base), which would darken the invalid red toward
 * black.
 */
export function applyInvalidTint(el: InvalidTintable, invalid: boolean): void {
  if (invalid) {
    el.tint = getStaticDI(ThemingService).currentTheme().invalid;
  } else {
    el.refreshTint();
  }
}
