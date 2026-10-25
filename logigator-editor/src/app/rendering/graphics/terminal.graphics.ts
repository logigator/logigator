import { StaticGraphicsContext } from './static-graphics-context';
import { PX } from '../../utils/grid';
import { getStaticDI } from '../../utils/get-di';
import { ThemingService } from '../../theming/theming.service';

/** Room between the screen's text and its frame, in grid units. */
export const TERMINAL_FRAME_PADDING = 0.25;
const FRAME_RADIUS = 0.2;

/**
 * The screen's frame around a `width` × `height` text area centred on the
 * origin, one screen pixel wide in the wire color.
 */
export class TerminalFrameGraphics extends StaticGraphicsContext {
  constructor(width: number, height: number, scale: number) {
    super();

    const theme = getStaticDI(ThemingService).currentTheme();
    this.smoothRoundRect(
      -width / 2 - TERMINAL_FRAME_PADDING,
      -height / 2 - TERMINAL_FRAME_PADDING,
      width + 2 * TERMINAL_FRAME_PADDING,
      height + 2 * TERMINAL_FRAME_PADDING,
      FRAME_RADIUS
    );
    this.stroke({ color: theme.wire, width: PX / scale });
  }
}

/**
 * The cursor block: a white unit square, shared across themes. Each instance
 * scales it to one character cell, tints it and moves it, so the cursor is
 * never redrawn.
 */
export class TerminalCursorGraphics extends StaticGraphicsContext {
  public static override readonly themeIndependent = true;

  constructor() {
    super();

    this.rect(0, 0, 1, 1);
    this.fill(0xffffff);
  }
}
