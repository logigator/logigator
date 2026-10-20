import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { Direction } from '../../model/direction';
import { BodySize, busLabels, ComponentMeta } from '../component-meta';

/** Data inputs: one per bit of the written byte, `D0` the least significant. */
export const TERMINAL_DATA_BITS = 8;

/** Input index of the clock, which follows the data bits. */
export const TERMINAL_CLOCK_INPUT = TERMINAL_DATA_BITS;

/**
 * Width of the label column beside the input ports. `CLK`, the longest label,
 * fits one cell at the canvas's full label size.
 */
export const TERMINAL_LABEL_COLUMN_WIDTH = 1;

export type TerminalTextSize = 'small' | 'large';

export interface TerminalValues {
  columns: number;
  rows: number;
  textSize: TerminalTextSize;
}

/** One character cell of the screen, in grid cells. */
export interface TerminalGlyphMetrics {
  /** Horizontal advance from one character to the next. */
  readonly advance: number;
  /** Distance from one text row to the next. */
  readonly lineHeight: number;
  readonly fontSize: number;
}

/** The screen box, upright whatever the body's direction. */
export interface TerminalScreen extends TerminalGlyphMetrics {
  /** `columns` advances wide. */
  readonly width: number;
  /** `rows` lines tall. */
  readonly height: number;
  /** Centre of the box in the body's unrotated local frame. */
  readonly centerX: number;
  readonly centerY: number;
}

const INPUT_LABELS = [...busLabels('D', TERMINAL_DATA_BITS), 'CLK'];

// Advance and line height in sixths of a cell, so an extent that is a whole
// number of cells comes out exact and `ceil` never rounds it up.
const GLYPH_SIXTHS: Record<
  TerminalTextSize,
  { advance: number; line: number }
> = {
  small: { advance: 2, line: 4 },
  large: { advance: 3, line: 6 }
};

// Roboto Mono advances 0.6 em and sets lines 1.2 em apart.
const ADVANCE_EM = 0.6;

const sixths = (textSize: TerminalTextSize) =>
  GLYPH_SIXTHS[textSize === 'large' ? 'large' : 'small'];

/** The glyph metrics of `textSize`, in grid cells. */
export function terminalGlyphMetrics(
  textSize: TerminalTextSize
): TerminalGlyphMetrics {
  const { advance, line } = sixths(textSize);
  return {
    advance: advance / 6,
    lineHeight: line / 6,
    fontSize: advance / 6 / ADVANCE_EM
  };
}

/** Upright screen extent before the body's direction places it. */
function screenExtent(o: TerminalValues): { width: number; height: number } {
  const { advance, line } = sixths(o.textSize);
  return { width: (o.columns * advance) / 6, height: (o.rows * line) / 6 };
}

/**
 * The label column, the screen and a half-cell margin around it. A quarter
 * turn keeps the screen upright, so its extents swap in the local frame. At
 * least one row per input.
 */
function terminalBody(o: TerminalValues, direction: Direction): BodySize {
  const screen = screenExtent(o);
  const quarterTurn = direction % 2 === 1;
  const across = quarterTurn ? screen.height : screen.width;
  const along = quarterTurn ? screen.width : screen.height;
  return {
    width: Math.ceil(TERMINAL_LABEL_COLUMN_WIDTH + across + 1),
    height: Math.max(INPUT_LABELS.length, Math.ceil(along + 1))
  };
}

/**
 * Where the screen sits for `o` in `direction`: centred in the body beside
 * the label column.
 */
export function terminalScreen(
  o: TerminalValues,
  direction: Direction
): TerminalScreen {
  const body = terminalBody(o, direction);
  return {
    ...terminalGlyphMetrics(o.textSize),
    ...screenExtent(o),
    centerX:
      TERMINAL_LABEL_COLUMN_WIDTH +
      (body.width - TERMINAL_LABEL_COLUMN_WIDTH) / 2,
    centerY: body.height / 2
  };
}

/**
 * A text screen: on each rising edge of `CLK` it prints the character whose
 * Latin-1 code is on `D0`…`D7`, or acts on it as a control code. It has no
 * outputs.
 */
export const terminalMeta = {
  type: BuiltInComponentType.TERMINAL,
  category: ComponentCategory.IO,
  symbol: 'TTY',
  name: 'components.def.TERMINAL.name',
  description: 'components.def.TERMINAL.description',
  options: {
    columns: {
      kind: 'number',
      label: 'components.def.TERMINAL.options.columns',
      min: 8,
      max: 80,
      default: 40
    },
    rows: {
      kind: 'number',
      label: 'components.def.TERMINAL.options.rows',
      min: 1,
      max: 24,
      default: 12
    },
    textSize: {
      kind: 'select-button',
      label: 'components.def.TERMINAL.options.textSize',
      values: [
        {
          value: 'small',
          labelKey: 'components.def.TERMINAL.textSizes.small'
        },
        {
          value: 'large',
          labelKey: 'components.def.TERMINAL.textSizes.large'
        }
      ],
      default: 'small'
    }
  },
  ports: () => ({ inputs: INPUT_LABELS.length, outputs: 0 }),
  labels: () => ({ inputs: [...INPUT_LABELS], outputs: [] }),
  body: terminalBody
} as const satisfies ComponentMeta<TerminalValues>;
