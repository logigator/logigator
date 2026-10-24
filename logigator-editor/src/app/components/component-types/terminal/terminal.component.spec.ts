import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BitmapText, Container, Graphics, Rectangle } from 'pixi.js';
import {
  Direction,
  TERMINAL_LABEL_COLUMN_WIDTH,
  terminalMeta,
  terminalScreen,
  TerminalTextSize,
  TerminalValues
} from '@logigator/core';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makeTerminal } from '../../../../testing/factories';
import {
  TERMINAL_FRAME_PADDING,
  TerminalCursorGraphics,
  TerminalFrameGraphics
} from '../../../rendering/graphics/terminal.graphics';
import { rotatedBox } from '../../component-geometry';
import { TerminalComponent } from './terminal.component';

const DIRECTIONS = [Direction.E, Direction.S, Direction.W, Direction.N];
const TEXT_SIZES: TerminalTextSize[] = ['small', 'large'];

/** Every node of the visual tree, in draw order. */
function flatten(node: Container, out: Container[] = []): Container[] {
  out.push(node);
  for (const child of node.children) {
    flatten(child as Container, out);
  }
  return out;
}

function graphicsOf(
  terminal: TerminalComponent,
  context: typeof TerminalFrameGraphics | typeof TerminalCursorGraphics
): Graphics {
  const found = flatten(terminal).filter(
    (node): node is Graphics =>
      node instanceof Graphics && node.context instanceof context
  );
  expect(found).toHaveLength(1);
  return found[0];
}

/** The screen's rows, top to bottom: the texts beside the frame. */
function rowTextsOf(terminal: TerminalComponent): BitmapText[] {
  return graphicsOf(terminal, TerminalFrameGraphics)
    .parent!.children.filter(
      (node): node is BitmapText => node instanceof BitmapText
    )
    .sort((a, b) => a.y - b.y);
}

function shown(terminal: TerminalComponent): string[] {
  return rowTextsOf(terminal).map((text) => text.text);
}

function records(text: string): Uint32Array {
  return Uint32Array.from([...text].map((char) => char.charCodeAt(0)));
}

function contains(outer: Rectangle, inner: Rectangle): boolean {
  return (
    inner.left >= outer.left &&
    inner.right <= outer.right &&
    inner.top >= outer.top &&
    inner.bottom <= outer.bottom
  );
}

describe('TerminalComponent', () => {
  beforeEach(() => {
    configureTestBed();
  });

  it('sizes the default and largest screens to 16×9 and 29×17 cells, a large default to 22×13', () => {
    const cases: [Partial<TerminalValues>, number, number][] = [
      [{}, 16, 9],
      [{ columns: 80, rows: 24 }, 29, 17],
      [{ textSize: 'large' }, 22, 13]
    ];
    for (const [options, width, height] of cases) {
      const terminal = makeTerminal(options);
      expect(terminal.bodyGridBounds.width).toBe(width);
      expect(terminal.bodyGridBounds.height).toBe(height);
      expect(terminal.numInputs).toBe(9);
      expect(terminal.numOutputs).toBe(0);
      terminal.destroy({ children: true });
    }
  });

  it('fits the upright screen inside the body beside the label column in every direction and size', () => {
    for (const textSize of TEXT_SIZES) {
      for (const [columns, rows] of [
        [8, 1],
        [40, 12],
        [80, 24],
        [13, 7]
      ]) {
        const values: TerminalValues = { columns, rows, textSize };
        const upright = terminalScreen(values, Direction.E);
        for (const direction of DIRECTIONS) {
          const at = `${columns}×${rows} ${textSize} direction ${direction}`;
          const terminal = makeTerminal(values, direction, 3, 5);
          const body = terminalMeta.body(values, direction);
          const bounds = terminal.bodyGridBounds;
          const quarterTurn = direction % 2 === 1;
          expect(bounds.width, at).toBe(quarterTurn ? body.height : body.width);
          expect(bounds.height, at).toBe(
            quarterTurn ? body.width : body.height
          );
          expect(terminal.connectionPoints, at).toHaveLength(9);

          const frame = graphicsOf(terminal, TerminalFrameGraphics).getBounds()
            .rectangle;
          expect(contains(bounds, frame), at).toBe(true);
          const labels = rotatedBox(
            direction,
            terminal.position,
            0,
            0,
            TERMINAL_LABEL_COLUMN_WIDTH,
            body.height
          );
          expect(frame.intersects(labels), at).toBe(false);
          // Upright: the screen's own extents on screen, whatever the turn.
          expect(frame.width, at).toBeCloseTo(
            upright.width + 2 * TERMINAL_FRAME_PADDING,
            0.5
          );
          expect(frame.height, at).toBeCloseTo(
            upright.height + 2 * TERMINAL_FRAME_PADDING,
            0.5
          );
          terminal.destroy({ children: true });
        }
      }
    }
  });

  it('draws one row text per screen row, each the screen row it shows', () => {
    const terminal = makeTerminal({ columns: 8, rows: 3 });
    terminal.setSimulating(true);
    terminal.applyRecords(0, records('hello world\nab\ncdé !\n'));

    expect(shown(terminal)).toEqual(
      Array.from({ length: 3 }, (_, row) => terminal.screen.rowText(row))
    );
    expect(shown(terminal)).toEqual(['ab', 'cdé !', '']);
    terminal.destroy({ children: true });
  });

  it('rewrites only the rows a batch changed, once each', () => {
    const terminal = makeTerminal({ columns: 8, rows: 4 });
    terminal.setSimulating(true);
    terminal.applyRecords(0, records('a\nb\nc'));
    const assigns = rowTextsOf(terminal).map((text) =>
      vi.spyOn(text, 'text', 'set')
    );

    // Home, down, overwrite row 1 twice; row 3 is never reached.
    terminal.applyRecords(5, records('\u000b\u001fXY\rZ'));
    expect(assigns.map((spy) => spy.mock.calls.length)).toEqual([0, 1, 0, 0]);
    expect(shown(terminal)).toEqual(['a', 'ZY', 'c', '']);
    terminal.destroy({ children: true });
  });

  it('marks records it never received as lost and goes on printing', () => {
    const terminal = makeTerminal({ columns: 8, rows: 2 });
    terminal.setSimulating(true);
    terminal.applyRecords(0, records('ab\n'));
    // Records 3…9 were overwritten before they were read.
    terminal.applyRecords(10, records('cd'));

    // The marker waits after `ab` until the row scrolls off.
    expect(terminal.screen.rowLost(0)).toBe(7);
    expect(shown(terminal)).toEqual(['ab', 'cd']);

    // A read reaching back before what was folded adds only the new ones.
    terminal.applyRecords(11, records('defg'));
    expect(shown(terminal)).toEqual(['ab', 'cdefg']);
    expect(terminal.screen.rowLost(0)).toBe(7);
    expect(terminal.screen.rowLost(1)).toBe(0);
    terminal.destroy({ children: true });
  });

  it('folds an empty read at the next record as no change', () => {
    const terminal = makeTerminal();
    terminal.applyRecords(0, records('ab'));
    const version = terminal.version();

    terminal.applyRecords(2, new Uint32Array(0));
    expect(terminal.version()).toBe(version);
    expect(terminal.screen.scrollbackEnd).toBe(0);
    terminal.destroy({ children: true });
  });

  it('starts over from record 0 after clearSimState, with nothing lost', () => {
    const terminal = makeTerminal({ columns: 8, rows: 1 });
    terminal.setSimulating(true);
    terminal.applyRecords(0, records('one\ntwo\nthree'));
    expect(terminal.screen.scrollbackEnd).toBe(2);

    terminal.clearSimState();
    expect(shown(terminal)).toEqual(['']);
    expect(terminal.screen.scrollbackEnd).toBe(0);

    terminal.applyRecords(0, records('z'));
    expect(shown(terminal)).toEqual(['z']);
    expect(terminal.screen.scrollbackEnd).toBe(0);
    terminal.destroy({ children: true });
  });

  it('bumps its version signal on every change a view must redraw for', () => {
    const terminal = makeTerminal();
    const versions = [terminal.version()];
    terminal.applyRecords(0, records('a'));
    versions.push(terminal.version());
    terminal.applyRecords(1, records('\u001d'));
    versions.push(terminal.version());
    terminal.applyRecords(5, records(''));
    versions.push(terminal.version());
    terminal.clearSimState();
    versions.push(terminal.version());

    for (let i = 1; i < versions.length; i++) {
      expect(versions[i]).toBeGreaterThan(versions[i - 1]);
    }
    expect(versions.at(-1)).toBe(terminal.screen.version);
    terminal.destroy({ children: true });
  });

  it('shows the cursor block only in a session, on the cell it is in', () => {
    const terminal = makeTerminal({ columns: 8, rows: 3 });
    const cursor = graphicsOf(terminal, TerminalCursorGraphics);
    const frame = graphicsOf(terminal, TerminalFrameGraphics);
    expect(cursor.alpha).toBe(0);
    const idleFrame = frame.alpha;

    terminal.setSimulating(true);
    expect(cursor.alpha).toBeGreaterThan(0);
    expect(frame.alpha).toBeGreaterThan(idleFrame);

    terminal.applyRecords(0, records('ab\ncde'));
    const { advance, lineHeight } = terminalScreen(
      { columns: 8, rows: 3, textSize: 'small' },
      Direction.E
    );
    const row = rowTextsOf(terminal)[1];
    expect(cursor.x - row.x).toBeCloseTo(3 * advance);
    expect(cursor.y).toBeLessThan(row.y);
    expect(cursor.y + lineHeight).toBeGreaterThan(row.y);
    expect(cursor.width).toBeCloseTo(advance);
    expect(cursor.height).toBeCloseTo(lineHeight);

    // A pause keeps the screen; leaving the session hides the cursor.
    terminal.setSimulating(false);
    expect(cursor.alpha).toBe(0);
    expect(frame.alpha).toBe(idleFrame);
    terminal.destroy({ children: true });
  });

  it('changes only texts, positions and alphas while printing, swapping no context', () => {
    const terminal = makeTerminal({ columns: 8, rows: 2 });
    terminal.setSimulating(true);
    const looks = () =>
      flatten(terminal).map((node) => ({
        node,
        context: node instanceof Graphics ? node.context : null,
        tint: node.tint,
        scale: [node.scale.x, node.scale.y]
      }));
    const before = looks();

    terminal.applyRecords(0, records('abcdefghij\nkl\fmn'));
    const after = looks();

    expect(after.map((entry) => entry.node)).toEqual(
      before.map((entry) => entry.node)
    );
    expect(after).toEqual(before);
    terminal.destroy({ children: true });
  });

  it('keeps the screen across a rotation, upright', () => {
    const terminal = makeTerminal({ columns: 8, rows: 2 });
    terminal.setSimulating(true);
    terminal.applyRecords(0, records('ab\ncd'));
    for (const direction of [Direction.S, Direction.W, Direction.N]) {
      terminal.direction = direction;
      expect(shown(terminal)).toEqual(['ab', 'cd']);
      const display = graphicsOf(terminal, TerminalFrameGraphics).parent!;
      expect(terminal.rotation + display.rotation).toBeCloseTo(0);
    }
    terminal.destroy({ children: true });
  });

  it('starts a resized screen over and draws a row text per new row', () => {
    const terminal = makeTerminal({ columns: 8, rows: 2 });
    terminal.applyRecords(0, records('ab'));
    const width = terminal.bodyGridBounds.width;

    terminal.options.rows.value = 5;
    expect(shown(terminal)).toEqual(['', '', '', '', '']);
    expect(terminal.screen.rows).toBe(5);

    terminal.options.columns.value = 80;
    expect(terminal.screen.columns).toBe(80);
    expect(terminal.bodyGridBounds.width).toBeGreaterThan(width);
    // The record count starts over with the screen.
    terminal.applyRecords(0, records('x'));
    expect(terminal.screen.scrollbackEnd).toBe(0);
    expect(shown(terminal)[0]).toBe('x');
    terminal.destroy({ children: true });
  });
});
