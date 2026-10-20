import { describe, expect, it } from 'vitest';
import {
  TERMINAL_SCROLLBACK_LIMIT,
  TerminalScreenBuffer,
  TerminalScrollbackEntry
} from './terminal-screen';

const BS = 0x08;
const HT = 0x09;
const LF = 0x0a;
const HOME = 0x0b;
const FF = 0x0c;
const CR = 0x0d;
const RIGHT = 0x1c;
const LEFT = 0x1d;
const UP = 0x1e;
const DOWN = 0x1f;
const DEL = 0x7f;

/** The codes of `text`, one per UTF-16 unit, each below 0x100. */
function codes(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0));
}

/** Folds a mix of strings (their codes) and single codes. */
function write(
  screen: TerminalScreenBuffer,
  ...parts: (string | number)[]
): void {
  screen.write(
    parts.flatMap((part) => (typeof part === 'string' ? codes(part) : [part]))
  );
}

function rows(screen: TerminalScreenBuffer): string[] {
  return Array.from({ length: screen.rows }, (_, row) => screen.rowText(row));
}

function cursor(screen: TerminalScreenBuffer): [number, number] {
  return [screen.cursorRow, screen.cursorColumn];
}

function lines(screen: TerminalScreenBuffer): string[] {
  return screen
    .scrollbackEntries()
    .map((entry) =>
      entry.kind === 'line' ? entry.text : `<lost ${entry.count}>`
    );
}

/** Screen rows whose version moved past `since`. */
function changedRows(screen: TerminalScreenBuffer, since: number): number[] {
  return Array.from({ length: screen.rows }, (_, row) => row).filter(
    (row) => screen.rowVersion(row) > since
  );
}

/** Everything a view can read, for comparing two screens. */
function state(screen: TerminalScreenBuffer) {
  return {
    rows: rows(screen),
    wrapped: Array.from({ length: screen.rows }, (_, row) =>
      screen.rowWrapped(row)
    ),
    lost: Array.from({ length: screen.rows }, (_, row) => screen.rowLost(row)),
    cursor: cursor(screen),
    pendingWrap: screen.pendingWrap,
    scrollback: screen.scrollbackEntries(),
    scrollbackEnd: screen.scrollbackEnd
  };
}

describe('TerminalScreenBuffer', () => {
  describe('printing', () => {
    it('prints printable ASCII and the Latin-1 printables at the cursor', () => {
      const screen = new TerminalScreenBuffer(8, 2);
      write(screen, ' ~', 0xa0, 0xe9, 0xff, 0xad);

      // The no-break space shows as a space, the soft hyphen as a hyphen.
      expect(rows(screen)).toEqual([' ~ éÿ-', '']);
      expect(cursor(screen)).toEqual([0, 6]);
    });

    it('ignores C1 codes and every control outside the set, changing nothing', () => {
      const screen = new TerminalScreenBuffer(8, 2);
      write(screen, 'abcdefgh');
      const before = state(screen);
      const version = screen.version;

      const ignored = [0x00, 0x01, 0x07, 0x0e, 0x1b];
      for (let code = 0x80; code < 0xa0; code++) {
        ignored.push(code);
      }
      screen.write(ignored);

      expect(state(screen)).toEqual(before);
      // An ignored code keeps the pending wrap, too.
      expect(screen.pendingWrap).toBe(true);
      expect(screen.version).toBe(version);
    });

    it('masks every code to a byte', () => {
      const screen = new TerminalScreenBuffer(8, 2);
      screen.write(new Uint32Array([0x141, 0xff42, 0x10a, 0x43]));

      expect(rows(screen)).toEqual(['AB', 'C']);
    });

    it('trims trailing empty cells but keeps printed spaces inside a row', () => {
      const screen = new TerminalScreenBuffer(8, 1);
      write(screen, 'a', RIGHT, RIGHT, 'b   ');

      expect(screen.rowText(0)).toBe('a  b   ');
      expect(cursor(screen)).toEqual([0, 7]);
    });
  });

  describe('deferred wrap', () => {
    it('leaves the cursor in the last column until the next printable', () => {
      const screen = new TerminalScreenBuffer(8, 3);
      write(screen, 'abcdefgh');

      expect(cursor(screen)).toEqual([0, 7]);
      expect(screen.pendingWrap).toBe(true);

      write(screen, 'i');
      expect(rows(screen)).toEqual(['abcdefgh', 'i', '']);
      expect(cursor(screen)).toEqual([1, 1]);
      expect(screen.rowWrapped(0)).toBe(true);
      expect(screen.rowWrapped(1)).toBe(false);
    });

    it('gives no blank line for an exact-width line and a line feed', () => {
      const screen = new TerminalScreenBuffer(8, 3);
      write(screen, 'abcdefgh', CR, LF, 'x');

      expect(rows(screen)).toEqual(['abcdefgh', 'x', '']);
      expect(screen.rowWrapped(0)).toBe(false);

      const bare = new TerminalScreenBuffer(8, 3);
      write(bare, 'abcdefgh', LF, 'x');
      expect(rows(bare)).toEqual(['abcdefgh', 'x', '']);
    });

    it('wraps and scrolls from the bottom-right corner', () => {
      const screen = new TerminalScreenBuffer(4, 2);
      write(screen, 'abcd', 'efgh');
      expect(rows(screen)).toEqual(['abcd', 'efgh']);
      expect(cursor(screen)).toEqual([1, 3]);
      expect(screen.scrollbackEnd).toBe(0);

      write(screen, 'i');
      expect(rows(screen)).toEqual(['efgh', 'i']);
      expect(cursor(screen)).toEqual([1, 1]);
      expect(screen.scrollbackEntries()).toEqual([
        { kind: 'line', text: 'abcd', wrapped: true }
      ]);
    });

    it('marks a one-row screen line as wrapped when it wraps out of the top', () => {
      const screen = new TerminalScreenBuffer(8, 1);
      write(screen, 'abcdefghi');

      expect(screen.scrollbackEntries()).toEqual([
        { kind: 'line', text: 'abcdefgh', wrapped: true }
      ]);
      expect(screen.rowText(0)).toBe('i');
    });

    it('drops a pending wrap on every cursor-moving code, even one clamped in place', () => {
      for (const code of [BS, HT, LF, HOME, FF, CR, RIGHT, LEFT, UP, DOWN]) {
        const screen = new TerminalScreenBuffer(8, 2);
        write(screen, 'abcdefgh', code);
        expect(screen.pendingWrap, `code ${code}`).toBe(false);
      }
    });

    it('keeps a pending wrap across a delete, which moves nothing', () => {
      const screen = new TerminalScreenBuffer(8, 2);
      write(screen, 'abcdefgh', DEL);

      expect(screen.rowText(0)).toBe('abcdefg');
      expect(screen.pendingWrap).toBe(true);
      write(screen, 'x');
      expect(rows(screen)).toEqual(['abcdefg', 'x']);
    });

    it('counts the cursor one past the last column while a wrap is pending', () => {
      // A backspace erases the character just printed in the last column.
      const back = new TerminalScreenBuffer(8, 2);
      write(back, 'abcdefgh', BS);
      expect(back.rowText(0)).toBe('abcdefg');
      expect(cursor(back)).toEqual([0, 7]);

      // A left lands on it, and the next character overwrites it.
      const left = new TerminalScreenBuffer(8, 2);
      write(left, 'abcdefgh', LEFT, 'X');
      expect(rows(left)).toEqual(['abcdefgX', '']);
      expect(left.pendingWrap).toBe(true);

      // A right is clamped at the edge and wraps nothing.
      const right = new TerminalScreenBuffer(8, 2);
      write(right, 'abcdefgh', RIGHT, 'X');
      expect(rows(right)).toEqual(['abcdefgX', '']);
    });
  });

  describe('control codes', () => {
    it('backspace moves left and erases, and stops at column 0', () => {
      const screen = new TerminalScreenBuffer(8, 2);
      write(screen, 'abc', BS);
      expect(screen.rowText(0)).toBe('ab');
      expect(cursor(screen)).toEqual([0, 2]);

      write(screen, BS, BS, BS, BS);
      expect(screen.rowText(0)).toBe('');
      expect(cursor(screen)).toEqual([0, 0]);

      // At column 0 it stays on the row: it never reaches the one above.
      write(screen, 'x', LF, BS);
      expect(rows(screen)).toEqual(['x', '']);
      expect(cursor(screen)).toEqual([1, 0]);
    });

    it('erases mid-row to a gap that shows as a space', () => {
      const screen = new TerminalScreenBuffer(8, 1);
      write(screen, 'abc', LEFT, LEFT, DEL);

      expect(screen.rowText(0)).toBe('a c');
      expect(cursor(screen)).toEqual([0, 1]);
    });

    it('tab moves to the next multiple of 8, clamped to the last column', () => {
      const screen = new TerminalScreenBuffer(20, 1);
      write(screen, HT);
      expect(screen.cursorColumn).toBe(8);
      write(screen, HT);
      expect(screen.cursorColumn).toBe(16);
      // The next stop, 24, is past the edge.
      write(screen, HT);
      expect(screen.cursorColumn).toBe(19);
      write(screen, HT);
      expect(screen.cursorColumn).toBe(19);
      expect(screen.pendingWrap).toBe(false);

      // From one before a stop, the stop; from on a stop, the next one.
      write(screen, CR, 'abcdefg', HT);
      expect(screen.cursorColumn).toBe(8);
      // Tab only moves: the cells it passes keep what they held.
      write(screen, CR, HT);
      expect(screen.rowText(0)).toBe('abcdefg');
    });

    it('tab on a narrow screen whose width is no multiple of 8', () => {
      const screen = new TerminalScreenBuffer(10, 1);
      write(screen, 'abcdefghi', HT);
      expect(screen.cursorColumn).toBe(9);

      write(screen, 'j', HT);
      // From past the edge, clamped back to the last column, wrap dropped.
      expect(cursor(screen)).toEqual([0, 9]);
      expect(screen.pendingWrap).toBe(false);
    });

    it('line feed goes to column 0 of the next row and scrolls only at the bottom', () => {
      const screen = new TerminalScreenBuffer(8, 3);
      write(screen, 'ab', LF);
      expect(cursor(screen)).toEqual([1, 0]);
      write(screen, 'cd', LF, 'ef', LF);
      expect(rows(screen)).toEqual(['cd', 'ef', '']);
      expect(cursor(screen)).toEqual([2, 0]);
      expect(lines(screen)).toEqual(['ab']);
    });

    it('carriage return goes to column 0 of the same row', () => {
      const screen = new TerminalScreenBuffer(8, 2);
      write(screen, 'abc', CR, 'X');
      expect(rows(screen)).toEqual(['Xbc', '']);
      expect(cursor(screen)).toEqual([0, 1]);
    });

    it('home goes to the top-left without erasing', () => {
      const screen = new TerminalScreenBuffer(8, 3);
      write(screen, 'ab', LF, 'cd', HOME, 'X');
      expect(rows(screen)).toEqual(['Xb', 'cd', '']);
      expect(cursor(screen)).toEqual([0, 1]);
    });

    it('form feed clears the screen and homes, leaving the scrollback alone', () => {
      const screen = new TerminalScreenBuffer(8, 2);
      write(screen, 'ab', LF, 'cd', LF, 'ef');
      const scrollback = screen.scrollbackEntries();

      write(screen, FF);
      expect(rows(screen)).toEqual(['', '']);
      expect(cursor(screen)).toEqual([0, 0]);
      expect(screen.scrollbackEntries()).toEqual(scrollback);
      expect(lines(screen)).toEqual(['ab']);

      write(screen, 'g');
      expect(rows(screen)).toEqual(['g', '']);
    });

    it('the four cursor codes move one cell and clamp at every edge, scrolling nothing', () => {
      const screen = new TerminalScreenBuffer(8, 3);
      write(screen, LEFT, UP);
      expect(cursor(screen)).toEqual([0, 0]);

      write(screen, RIGHT, DOWN);
      expect(cursor(screen)).toEqual([1, 1]);

      write(screen, ...Array<number>(10).fill(RIGHT));
      write(screen, ...Array<number>(10).fill(DOWN));
      expect(cursor(screen)).toEqual([2, 7]);
      expect(screen.pendingWrap).toBe(false);
      expect(screen.scrollbackEnd).toBe(0);

      write(screen, UP, LEFT);
      expect(cursor(screen)).toEqual([1, 6]);
    });

    it('cursor codes act on the screen only, never reaching the scrollback', () => {
      const screen = new TerminalScreenBuffer(8, 2);
      write(screen, 'ab', LF, 'cd', LF, 'ef');
      write(screen, UP, UP, UP, LEFT, 'X');
      expect(rows(screen)).toEqual(['cX', 'ef']);
      expect(lines(screen)).toEqual(['ab']);
    });

    it('up and down keep the column of a pending wrap, on the last column', () => {
      const screen = new TerminalScreenBuffer(8, 2);
      write(screen, 'abcdefgh', DOWN, 'X');
      expect(rows(screen)).toEqual(['abcdefgh', '       X']);
      expect(screen.rowWrapped(0)).toBe(false);
    });
  });

  describe('scrollback', () => {
    it('freezes each line as it left the top', () => {
      const screen = new TerminalScreenBuffer(8, 2);
      write(screen, 'one', LF, 'two', LF, 'three', LF);
      expect(lines(screen)).toEqual(['one', 'two']);

      // Editing what is left on the screen changes nothing scrolled off.
      write(screen, HOME, 'XXXXX');
      expect(lines(screen)).toEqual(['one', 'two']);
      expect(rows(screen)).toEqual(['XXXXX', '']);
    });

    it('keeps the newest lines past the cap, addressed by a stable index', () => {
      const screen = new TerminalScreenBuffer(8, 1);
      const total = TERMINAL_SCROLLBACK_LIMIT + 5;
      for (let i = 0; i < total; i++) {
        write(screen, String(i), LF);
      }

      const entries = screen.scrollbackEntries();
      expect(entries).toHaveLength(TERMINAL_SCROLLBACK_LIMIT);
      expect(entries[0]).toEqual({ kind: 'line', text: '5', wrapped: false });
      expect(entries.at(-1)).toEqual({
        kind: 'line',
        text: String(total - 1),
        wrapped: false
      });
      expect(screen.scrollbackEnd).toBe(total);
      expect(screen.scrollbackStart).toBe(5);
      expect(screen.scrollbackAt(4)).toBeUndefined();
      expect(screen.scrollbackAt(5)).toEqual(entries[0]);
      expect(screen.scrollbackAt(total - 1)).toEqual(entries.at(-1));
      expect(screen.scrollbackAt(total)).toBeUndefined();
    });

    it('marks lost characters in place and goes on printing', () => {
      const screen = new TerminalScreenBuffer(8, 1);
      write(screen, 'ab', LF);
      screen.markLost(42);
      write(screen, 'cd', LF);
      screen.markLost(0);
      screen.markLost(3);

      expect(screen.scrollbackEntries()).toEqual<TerminalScrollbackEntry[]>([
        { kind: 'line', text: 'ab', wrapped: false },
        { kind: 'lost', count: 42 },
        { kind: 'line', text: 'cd', wrapped: false },
        { kind: 'lost', count: 3 }
      ]);
      expect(screen.rowText(0)).toBe('');
      expect(cursor(screen)).toEqual([0, 0]);
    });

    it('puts a lost marker after the rows printed before the loss, as they scroll off', () => {
      const screen = new TerminalScreenBuffer(8, 2);
      write(screen, 'AAA', LF, 'BBB');
      screen.markLost(5);
      expect(screen.rowLost(1)).toBe(5);
      expect(screen.scrollbackEnd).toBe(0);

      write(screen, LF, 'CCC', LF, 'DDD');
      expect(lines(screen)).toEqual(['AAA', 'BBB', '<lost 5>']);
      expect(rows(screen)).toEqual(['CCC', 'DDD']);
      expect([screen.rowLost(0), screen.rowLost(1)]).toEqual([0, 0]);
    });

    it('puts a loss at the start of an empty row after the row above', () => {
      const screen = new TerminalScreenBuffer(8, 3);
      write(screen, 'one', LF);
      screen.markLost(4);
      write(screen, 'two', LF, LF, LF);

      expect(lines(screen)).toEqual(['one', '<lost 4>', 'two']);
    });

    it('adds up the losses after one row into one marker, and keeps rows apart', () => {
      const screen = new TerminalScreenBuffer(8, 2);
      write(screen, 'ab');
      screen.markLost(2);
      write(screen, 'c');
      screen.markLost(3);
      write(screen, LF, 'd');
      screen.markLost(1);
      write(screen, LF, LF);

      expect(lines(screen)).toEqual(['abc', '<lost 5>', 'd', '<lost 1>']);
    });

    it('keeps a marker with the row the cursor was moved up to', () => {
      const screen = new TerminalScreenBuffer(8, 3);
      write(screen, 'a', LF, 'b', LF, 'c', UP, UP);
      screen.markLost(7);
      write(screen, 'x');
      expect([0, 1, 2].map((row) => screen.rowLost(row))).toEqual([7, 0, 0]);

      write(screen, DOWN, DOWN, LF);
      expect(lines(screen)).toEqual(['ax', '<lost 7>']);
    });

    it('splits a line wrapping out of the top around a loss before the wrap', () => {
      const screen = new TerminalScreenBuffer(8, 1);
      write(screen, 'abcdefgh');
      screen.markLost(2);
      write(screen, 'i');

      expect(screen.scrollbackEntries()).toEqual<TerminalScrollbackEntry[]>([
        { kind: 'line', text: 'abcdefgh', wrapped: true },
        { kind: 'lost', count: 2 }
      ]);
    });

    it('pushes the markers of a screen a form feed discards, top row first', () => {
      const screen = new TerminalScreenBuffer(8, 3);
      write(screen, 'ab');
      screen.markLost(1);
      write(screen, LF, 'cd');
      screen.markLost(2);
      write(screen, FF);

      expect(lines(screen)).toEqual(['<lost 1>', '<lost 2>']);
      expect([0, 1, 2].map((row) => screen.rowLost(row))).toEqual([0, 0, 0]);

      write(screen, 'e', LF, LF, LF);
      expect(lines(screen)).toEqual(['<lost 1>', '<lost 2>', 'e']);
    });

    it('reset clears the screen, the scrollback, the pending markers and the cursor', () => {
      const screen = new TerminalScreenBuffer(8, 2);
      write(screen, 'ab', LF, 'cd', LF, 'efghijkl');
      screen.markLost(1);
      expect(screen.rowLost(1)).toBe(1);
      const version = screen.version;

      screen.reset();
      expect(state(screen)).toEqual(state(new TerminalScreenBuffer(8, 2)));
      expect(screen.version).toBeGreaterThan(version);
    });
  });

  describe('change tracking', () => {
    it('moves exactly the rows a write touched', () => {
      const screen = new TerminalScreenBuffer(8, 4);
      write(screen, 'a', LF, 'b', LF, 'c');
      const since = screen.version;

      write(screen, HOME, DOWN, 'X', DOWN, LEFT, DEL);
      expect(changedRows(screen, since)).toEqual([1, 2]);
      expect(screen.version).toBeGreaterThan(since);
    });

    it('moves no row for a cursor move, only the version', () => {
      const screen = new TerminalScreenBuffer(8, 4);
      write(screen, 'abc');
      const since = screen.version;

      write(screen, CR, DOWN, RIGHT);
      expect(changedRows(screen, since)).toEqual([]);
      expect(screen.version).toBeGreaterThan(since);
    });

    it('moves no row for an overwrite with the same character, nor an erase of an empty cell', () => {
      const screen = new TerminalScreenBuffer(8, 2);
      write(screen, 'abc');
      const since = screen.version;

      write(screen, CR, 'abc', LF, DEL);
      expect(changedRows(screen, since)).toEqual([]);
    });

    it('moves every row on a scroll and a form feed', () => {
      const scroll = new TerminalScreenBuffer(8, 3);
      write(scroll, LF, LF);
      const beforeScroll = scroll.version;
      write(scroll, LF);
      expect(changedRows(scroll, beforeScroll)).toEqual([0, 1, 2]);

      const clear = new TerminalScreenBuffer(8, 3);
      write(clear, 'a');
      const beforeClear = clear.version;
      write(clear, FF);
      expect(changedRows(clear, beforeClear)).toEqual([0, 1, 2]);
    });

    it('stamps a whole write with one version', () => {
      const screen = new TerminalScreenBuffer(8, 3);
      const since = screen.version;
      write(screen, 'a', LF, 'b', LF, 'c', LF, 'd');
      expect(screen.version).toBe(since + 1);
    });
  });

  it('folds a stream split at any points as it does in one batch', () => {
    // A seeded generator, so a failure reproduces.
    let seed = 0x2545f491;
    const random = (bound: number) => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) % bound;
    };
    const alphabet = [
      ...codes('abcxyz0 '),
      BS,
      HT,
      LF,
      HOME,
      CR,
      RIGHT,
      LEFT,
      UP,
      DOWN,
      DEL,
      0x00,
      0x85,
      0xa0,
      0xe9
    ];

    for (let round = 0; round < 40; round++) {
      const columns = 8 + random(5);
      const rowCount = 1 + random(4);
      const stream = Uint32Array.from({ length: 400 }, () =>
        random(50) === 0 ? FF : alphabet[random(alphabet.length)]
      );

      const whole = new TerminalScreenBuffer(columns, rowCount);
      whole.write(stream);

      const split = new TerminalScreenBuffer(columns, rowCount);
      let at = 0;
      while (at < stream.length) {
        const end = Math.min(stream.length, at + 1 + random(30));
        split.write(stream, at, end);
        at = end;
      }

      expect(state(split), `round ${round}`).toEqual(state(whole));
    }
  });

  it('folds a full frame of records', () => {
    const screen = new TerminalScreenBuffer(80, 24);
    const frame = Uint32Array.from({ length: 65_536 }, (_, i) =>
      i % 81 === 80 ? LF : 0x41 + (i % 26)
    );
    screen.write(frame);

    // 65 536 codes are 809 full lines and a partial one.
    expect(screen.scrollbackEnd).toBe(809 - 23);
    expect(screen.rowText(23)).toHaveLength(65_536 - 809 * 81);
  });
});
