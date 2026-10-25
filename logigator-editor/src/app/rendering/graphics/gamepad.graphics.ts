import { StaticGraphicsContext } from './static-graphics-context';
import { PX } from '../../utils/grid';
import { getStaticDI } from '../../utils/get-di';
import { ThemingService } from '../../theming/theming.service';

/**
 * One gamepad control's shape in grid units, centred on the local origin: a
 * disc (a face button) or a rounded rectangle (a D-pad arm, a shoulder bar, a
 * menu pill).
 */
export type GamepadGlyphShape =
  | { readonly kind: 'disc'; readonly radius: number }
  | {
      readonly kind: 'rect';
      readonly width: number;
      readonly height: number;
      readonly radius: number;
    };

/** Traces a control's shape; the subclass fills or strokes it. */
abstract class GamepadShapeGraphics extends StaticGraphicsContext {
  protected trace(shape: GamepadGlyphShape): void {
    if (shape.kind === 'disc') {
      this.smoothCircle(0, 0, shape.radius);
    } else {
      this.smoothRoundRect(
        -shape.width / 2,
        -shape.height / 2,
        shape.width,
        shape.height,
        shape.radius
      );
    }
  }
}

/** A control's outline: one screen pixel wide, in the wire color. */
export class GamepadControlOutlineGraphics extends GamepadShapeGraphics {
  constructor(shape: GamepadGlyphShape, scale: number) {
    super();

    const theme = getStaticDI(ThemingService).currentTheme();
    this.trace(shape);
    this.stroke({ color: theme.wire, width: PX / scale });
  }
}

/**
 * A control's pressed fill: its shape in white, shared across themes. Each
 * instance tints it to the wire color and shows it by alpha alone, so a press
 * is neither a redraw nor a context swap.
 */
export class GamepadControlFillGraphics extends GamepadShapeGraphics {
  public static override readonly themeIndependent = true;

  constructor(shape: GamepadGlyphShape) {
    super();

    this.trace(shape);
    this.fill(0xffffff);
  }
}

/**
 * The rule between two control groups: a horizontal line from the origin to
 * `width`, one screen pixel wide and fainter than the body frame.
 */
export class GamepadRuleGraphics extends StaticGraphicsContext {
  constructor(width: number, scale: number) {
    super();

    const theme = getStaticDI(ThemingService).currentTheme();
    this.moveTo(0, 0);
    this.lineTo(width, 0);
    this.stroke({ color: theme.wire, width: PX / scale, alpha: 0.5 });
  }
}
