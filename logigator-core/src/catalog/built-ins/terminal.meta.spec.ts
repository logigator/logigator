import { describe, expect, it } from 'vitest';
import { assembleCircuitFile } from '../../format/assemble-circuit-file';
import { CircuitIntegrityError } from '../../format/circuit-file.errors';
import { parseCircuitDocument } from '../../format/parse-circuit-document';
import { BuiltInComponentType } from '../../model/component-type.enum';
import { Direction } from '../../model/direction';
import { SerializedComponentBody } from '../../model/serialized-circuit';
import {
  TERMINAL_CLOCK_INPUT,
  TERMINAL_DATA_BITS,
  TERMINAL_LABEL_COLUMN_WIDTH,
  TerminalTextSize,
  TerminalValues,
  terminalGlyphMetrics,
  terminalMeta,
  terminalScreen
} from './terminal.meta';

const DIRECTIONS = [Direction.E, Direction.S, Direction.W, Direction.N];
const TEXT_SIZES: TerminalTextSize[] = ['small', 'large'];

const { columns, rows } = terminalMeta.options;
const EXTREMES: TerminalValues[] = TEXT_SIZES.flatMap((textSize) =>
  [columns.min, columns.min + 1, columns.max - 1, columns.max].flatMap((c) =>
    [rows.min, rows.min + 1, rows.max - 1, rows.max].map((r) => ({
      columns: c,
      rows: r,
      textSize
    }))
  )
);

const size = (o: TerminalValues, direction: Direction) =>
  terminalMeta.body(o, direction);

describe('terminalMeta', () => {
  it('takes the data bits first, least significant first, then the clock', () => {
    const { inputs, outputs } = terminalMeta.ports();
    const labels = terminalMeta.labels().inputs;
    expect(outputs).toBe(0);
    expect(inputs).toBe(TERMINAL_DATA_BITS + 1);
    expect(labels.slice(0, TERMINAL_DATA_BITS)).toEqual(
      Array.from({ length: TERMINAL_DATA_BITS }, (_, bit) => `D${bit}`)
    );
    expect(labels[TERMINAL_CLOCK_INPUT]).toBe('CLK');
    expect(labels).toHaveLength(inputs);
  });

  it('sets glyphs 0.6 em wide and 1.2 em apart', () => {
    for (const textSize of TEXT_SIZES) {
      const { advance, lineHeight, fontSize } = terminalGlyphMetrics(textSize);
      expect(advance).toBeCloseTo(0.6 * fontSize);
      expect(lineHeight).toBeCloseTo(1.2 * fontSize);
    }
    expect(terminalGlyphMetrics('small').advance).toBeCloseTo(1 / 3);
    expect(terminalGlyphMetrics('large').advance).toBeCloseTo(1 / 2);
  });

  it('sizes the body around the screen', () => {
    const at = (columns: number, rows: number, textSize: TerminalTextSize) =>
      size({ columns, rows, textSize }, Direction.E);
    expect(at(40, 12, 'small')).toEqual({ width: 16, height: 9 });
    expect(at(80, 24, 'small')).toEqual({ width: 29, height: 17 });
    expect(at(40, 12, 'large')).toEqual({ width: 22, height: 13 });
  });

  it('swaps the screen extents on a quarter turn and nowhere else', () => {
    for (const o of EXTREMES) {
      const east = size(o, Direction.E);
      const south = size(o, Direction.S);
      expect(size(o, Direction.W)).toEqual(east);
      expect(size(o, Direction.N)).toEqual(south);

      const screen = terminalScreen(o, Direction.E);
      expect(south.width).toBe(
        Math.ceil(TERMINAL_LABEL_COLUMN_WIDTH + screen.height + 1)
      );
      expect(south.height).toBe(
        Math.max(terminalMeta.ports().inputs, Math.ceil(screen.width + 1))
      );
    }
  });

  it('keeps one row per input however small the screen', () => {
    for (const textSize of TEXT_SIZES) {
      const o = { columns: columns.min, rows: rows.min, textSize };
      for (const direction of DIRECTIONS) {
        expect(size(o, direction).height).toBe(terminalMeta.ports().inputs);
      }
    }
  });

  it('does not round a screen of whole cells up', () => {
    // In small text, 24 columns are 8 cells, 15 rows 10 and 3 rows 2.
    expect(
      size({ columns: 24, rows: 15, textSize: 'small' }, Direction.E)
    ).toEqual({ width: 10, height: 11 });
    expect(
      size({ columns: 24, rows: 3, textSize: 'small' }, Direction.S)
    ).toEqual({ width: 4, height: 9 });
  });

  for (const direction of DIRECTIONS) {
    it(`fits the screen beside the label column with half a cell to spare, and no more body than that (direction ${direction})`, () => {
      for (const o of EXTREMES) {
        const body = size(o, direction);
        const screen = terminalScreen(o, direction);
        const quarterTurn = direction % 2 === 1;
        const across = quarterTurn ? screen.height : screen.width;
        const along = quarterTurn ? screen.width : screen.height;

        expect(screen.width).toBeCloseTo(o.columns * screen.advance);
        expect(screen.height).toBeCloseTo(o.rows * screen.lineHeight);

        const left = screen.centerX - across / 2;
        const right = screen.centerX + across / 2;
        const top = screen.centerY - along / 2;
        const bottom = screen.centerY + along / 2;
        expect(left - TERMINAL_LABEL_COLUMN_WIDTH).toBeCloseTo(
          body.width - right
        );
        expect(top).toBeCloseTo(body.height - bottom);
        expect(left).toBeGreaterThanOrEqual(TERMINAL_LABEL_COLUMN_WIDTH + 0.5);
        expect(top).toBeGreaterThanOrEqual(0.5);

        // A cell narrower would leave less than the half-cell margin.
        expect(left - TERMINAL_LABEL_COLUMN_WIDTH).toBeLessThan(1);
        if (body.height > terminalMeta.ports().inputs) {
          expect(top).toBeLessThan(1);
        }
      }
    });
  }
});

describe('a terminal in a document', () => {
  const terminal = (
    options: Record<string, unknown>,
    direction?: Direction
  ): SerializedComponentBody => ({
    type: BuiltInComponentType.TERMINAL,
    pos: [0, 0],
    ...(direction === undefined ? {} : { direction }),
    options
  });

  const parse = (...components: SerializedComponentBody[]) => {
    const { file } = assembleCircuitFile({ components, wires: [] }, [], 'Tty');
    return parseCircuitDocument(JSON.parse(JSON.stringify(file)));
  };

  it('reads back strictly with its options and direction', () => {
    const parsed = parse(
      terminal({ columns: 80, rows: 24, textSize: 'large' }, Direction.S),
      terminal({ columns: 8, rows: 1, textSize: 'small' })
    );
    expect(parsed.warnings).toEqual([]);
    expect(
      parsed.body.components.map((c) => [c.options, c.direction ?? 0])
    ).toEqual(
      expect.arrayContaining([
        [{ columns: 80, rows: 24, textSize: 'large' }, Direction.S],
        [{ columns: 8, rows: 1, textSize: 'small' }, Direction.E]
      ])
    );
  });

  it('fills the defaults for options it does not name', () => {
    const parsed = parse(terminal({}));
    expect(parsed.body.components[0].options).toEqual({
      columns: 40,
      rows: 12,
      textSize: 'small'
    });
  });

  it('is refused with a text size or a size outside the schema', () => {
    for (const options of [
      { textSize: 'huge' },
      { columns: 81 },
      { rows: 0 }
    ]) {
      expect(() => parse(terminal(options))).toThrowError(
        CircuitIntegrityError
      );
    }
  });
});
