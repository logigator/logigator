import { StaticGraphicsContext } from './static-graphics-context';
import { PX } from '../../utils/grid';
import { getStaticDI } from '../../utils/get-di';
import { ThemingService } from '../../theming/theming.service';

/** Side of one small key, in grid units. */
const KEY = 0.3;
/** Distance between neighbouring keys, in grid units. */
const KEY_PITCH = 0.38;
/** Keys per row, top to bottom, and the space bar's width in key pitches. */
const KEY_ROWS = [6, 6, 5] as const;
const SPACE_BAR_PITCHES = 4;
/** Room between the case and its outermost keys. */
const CASE_PADDING = 0.15;

/** Width of the glyph column the keycaps and the readout are centred in. */
const COLUMN_WIDTH = 3;
/**
 * Vertical centre of the keycaps: the bottom of row 2, so they and the
 * readout box under them sit centred on the body's ten rows.
 */
const KEYCAPS_CENTRE_Y = 3;

/**
 * The readout box, in the body's grid units: a square under the keycaps,
 * across rows 5–7 of the glyph column, inset from the column's edges, so it
 * fits upright in every direction.
 */
export const KEYBOARD_READOUT_BOX = {
  x: 0.3,
  y: 5.3,
  size: 2.4,
  radius: 0.2
} as const;

/**
 * The keyboard's keycap glyph at the top of the glyph column: three rows of
 * small keys and a space bar in the wire color, inside a case outlined one
 * screen pixel wide. Drawn in the body's own coordinates.
 */
export class KeyboardKeycapGraphics extends StaticGraphicsContext {
  constructor(scale: number) {
    super();

    const theme = getStaticDI(ThemingService).currentTheme();
    const rows = KEY_ROWS.length + 1;
    const blockWidth = (Math.max(...KEY_ROWS) - 1) * KEY_PITCH + KEY;
    const blockHeight = (rows - 1) * KEY_PITCH + KEY;
    const left = (COLUMN_WIDTH - blockWidth) / 2;
    const top = KEYCAPS_CENTRE_Y - blockHeight / 2;

    KEY_ROWS.forEach((keys, row) => {
      const rowLeft = left + (blockWidth - ((keys - 1) * KEY_PITCH + KEY)) / 2;
      for (let key = 0; key < keys; key++) {
        this.rect(rowLeft + key * KEY_PITCH, top + row * KEY_PITCH, KEY, KEY);
      }
    });
    const spaceWidth = SPACE_BAR_PITCHES * KEY_PITCH - (KEY_PITCH - KEY);
    this.rect(
      (COLUMN_WIDTH - spaceWidth) / 2,
      top + KEY_ROWS.length * KEY_PITCH,
      spaceWidth,
      KEY
    );
    this.fill(theme.wire);

    this.smoothRoundRect(
      left - CASE_PADDING,
      top - CASE_PADDING,
      blockWidth + 2 * CASE_PADDING,
      blockHeight + 2 * CASE_PADDING,
      CASE_PADDING
    );
    this.stroke({ color: theme.wire, width: PX / scale });
  }
}

/** The readout box's outline: one screen pixel wide, in the wire color. */
export class KeyboardReadoutFrameGraphics extends StaticGraphicsContext {
  constructor(scale: number) {
    super();

    const theme = getStaticDI(ThemingService).currentTheme();
    const { x, y, size, radius } = KEYBOARD_READOUT_BOX;
    this.smoothRoundRect(x, y, size, size, radius);
    this.stroke({ color: theme.wire, width: PX / scale });
  }
}

/**
 * The readout box's fill: its shape in white, shared across themes. Each
 * instance tints it and shows it by alpha alone, so lighting it is neither a
 * redraw nor a context swap.
 */
export class KeyboardReadoutFillGraphics extends StaticGraphicsContext {
  public static override readonly themeIndependent = true;

  constructor() {
    super();

    const { x, y, size, radius } = KEYBOARD_READOUT_BOX;
    this.smoothRoundRect(x, y, size, size, radius);
    this.fill(0xffffff);
  }
}
