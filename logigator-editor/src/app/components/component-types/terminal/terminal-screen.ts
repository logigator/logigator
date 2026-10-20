/** Lines the scrollback holds; the oldest go first. */
export const TERMINAL_SCROLLBACK_LIMIT = 10_000;

/** One entry of the scrollback, oldest first. */
export type TerminalScrollbackEntry =
  | {
      readonly kind: 'line';
      /** The row as it scrolled off, trailing empty cells trimmed. */
      readonly text: string;
      /** Whether the text continues on the next line by a wrap. */
      readonly wrapped: boolean;
    }
  | {
      /** Characters the engine overwrote before they were read. */
      readonly kind: 'lost';
      readonly count: number;
    };

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

/** A cell nothing was printed to, or that was erased. */
const EMPTY = 0;
const SPACE = 0x20;
const TAB_STOP = 8;

/** What a view of a screen reads; only its owner changes it. */
export type TerminalScreenView = Omit<
  TerminalScreenBuffer,
  'write' | 'markLost' | 'reset' | 'resize'
>;

/** Whether `code` prints: printable ASCII and the Latin-1 printables. */
export function isTerminalPrintable(code: number): boolean {
  return (code >= 0x20 && code < 0x7f) || (code >= 0xa0 && code <= 0xff);
}

/**
 * The character a printed code is shown as. A no-break space shows as a
 * space and a soft hyphen as a hyphen: both would otherwise draw with no
 * advance, or none at all, and shift the rest of the row.
 */
export function terminalGlyph(code: number): number {
  if (code === EMPTY || code === 0xa0) {
    return SPACE;
  }
  return code === 0xad ? 0x2d : code;
}

/**
 * A text screen of `columns` × `rows` cells and the scrollback of lines that
 * left it at the top. Bytes are folded in through {@link write}: Latin-1
 * printables print at the cursor, the MSX control set moves it, and every
 * other code is ignored.
 *
 * Wrapping is deferred: a character printed in the last column leaves the
 * cursor there with a wrap pending, and only the next printable wraps, so a
 * full line followed by a line feed leaves no blank line. Every
 * cursor-moving code drops a pending wrap, and a horizontal one moves from
 * one past the last column, so a backspace or a left erases or lands on the character just
 * printed there.
 *
 * Every change is stamped with the next {@link version}; {@link rowVersion}
 * tells a renderer which rows changed since the version it last drew.
 */
export class TerminalScreenBuffer {
  private _columns = 0;
  private _rows = 0;
  // Physical rows; screen row `r` is `_cells[(_top + r) % _rows]`, so a
  // scroll rotates `_top` rather than moving cells.
  private _cells: Uint8Array[] = [];
  private _top = 0;
  private _wrapped = new Uint8Array(0);
  private _rowStamp = new Uint32Array(0);
  private _rowText: (string | null)[] = [];
  // Characters lost after each physical row, pushed when the row leaves.
  private _rowLost: number[] = [];
  // A stamp every row carries at least: a scroll moves every row's content.
  private _allRowsStamp = 0;
  private _scratch = new Uint8Array(0);

  private _cursorRow = 0;
  private _cursorColumn = 0;
  private _pendingWrap = false;

  private _scrollback: TerminalScrollbackEntry[] = [];
  private _scrollbackEnd = 0;

  private _version = 0;
  // The version the running call's changes are stamped with.
  private _stamp = 0;
  private _changed = false;

  constructor(columns: number, rows: number) {
    this.resize(columns, rows);
  }

  public get columns(): number {
    return this._columns;
  }

  public get rows(): number {
    return this._rows;
  }

  /** Bumped by every change to the screen, the cursor or the scrollback. */
  public get version(): number {
    return this._version;
  }

  public get cursorRow(): number {
    return this._cursorRow;
  }

  /** The column the cursor is drawn in; the last one while a wrap is pending. */
  public get cursorColumn(): number {
    return this._cursorColumn;
  }

  /** Whether the next printable wraps to the start of the next line first. */
  public get pendingWrap(): boolean {
    return this._pendingWrap;
  }

  /**
   * Index past the newest scrollback entry: entries are addressed by the
   * count pushed before them, so an index stays valid as the oldest go.
   */
  public get scrollbackEnd(): number {
    return this._scrollbackEnd;
  }

  /** Index of the oldest entry still held. */
  public get scrollbackStart(): number {
    return Math.max(0, this._scrollbackEnd - TERMINAL_SCROLLBACK_LIMIT);
  }

  /** The entry at `index`, or `undefined` outside what is held. */
  public scrollbackAt(index: number): TerminalScrollbackEntry | undefined {
    return index >= this.scrollbackStart && index < this._scrollbackEnd
      ? this._scrollback[index % TERMINAL_SCROLLBACK_LIMIT]
      : undefined;
  }

  /** Every entry held, oldest first. */
  public scrollbackEntries(): TerminalScrollbackEntry[] {
    const entries: TerminalScrollbackEntry[] = [];
    for (let i = this.scrollbackStart; i < this._scrollbackEnd; i++) {
      entries.push(this._scrollback[i % TERMINAL_SCROLLBACK_LIMIT]);
    }
    return entries;
  }

  /**
   * Screen row `row` as it is shown (see {@link terminalGlyph}), trailing
   * empty cells trimmed. Built once per change of the row.
   */
  public rowText(row: number): string {
    const physical = this._physical(row);
    return (this._rowText[physical] ??= this._buildText(physical));
  }

  /** Whether screen row `row` continues on the next row by a wrap. */
  public rowWrapped(row: number): boolean {
    return this._wrapped[this._physical(row)] === 1;
  }

  /**
   * Characters lost after screen row `row`, 0 for none: the marker goes
   * into the scrollback right after the row when the row leaves the screen.
   */
  public rowLost(row: number): number {
    return this._rowLost[this._physical(row)];
  }

  /** The version that last changed screen row `row`. */
  public rowVersion(row: number): number {
    return Math.max(this._rowStamp[this._physical(row)], this._allRowsStamp);
  }

  /**
   * Folds `codes[start…end)` into the screen, each masked to a byte. A whole
   * frame's worth is one version.
   */
  public write(
    codes: ArrayLike<number>,
    start = 0,
    end: number = codes.length
  ): void {
    this._begin();
    for (let i = start; i < end; i++) {
      const code = codes[i] & 0xff;
      if (isTerminalPrintable(code)) {
        this._print(code);
      } else {
        this._control(code);
      }
    }
    this._commit();
  }

  /**
   * Records that `count` characters never reached the screen, after the
   * cursor's row, or after the row above when the cursor starts an empty row:
   * what was printed before the loss is on the screen until it scrolls off.
   */
  public markLost(count: number): void {
    if (count <= 0) {
      return;
    }
    this._begin();
    const row =
      this._cursorColumn === 0 &&
      !this._pendingWrap &&
      this.rowText(this._cursorRow) === ''
        ? this._cursorRow - 1
        : this._cursorRow;
    if (row < 0) {
      this._pushScrollback({ kind: 'lost', count });
    } else {
      this._rowLost[this._physical(row)] += count;
      this._changed = true;
    }
    this._commit();
  }

  /** Clears the screen and the scrollback and homes the cursor. */
  public reset(): void {
    this.resize(this._columns, this._rows);
  }

  /** {@link reset} into a screen of `columns` × `rows`. */
  public resize(columns: number, rows: number): void {
    this._begin();
    this._columns = columns;
    this._rows = rows;
    this._cells = Array.from({ length: rows }, () => new Uint8Array(columns));
    this._top = 0;
    this._wrapped = new Uint8Array(rows);
    this._rowStamp = new Uint32Array(rows);
    this._rowText = new Array<string | null>(rows).fill('');
    this._rowLost = new Array<number>(rows).fill(0);
    this._allRowsStamp = this._stamp;
    this._scratch = new Uint8Array(columns);
    this._cursorRow = 0;
    this._cursorColumn = 0;
    this._pendingWrap = false;
    this._scrollback = [];
    this._scrollbackEnd = 0;
    this._version = this._stamp;
  }

  private _begin(): void {
    this._stamp = this._version + 1;
  }

  // An ignored code is no change, and bumps nothing.
  private _commit(): void {
    if (this._changed) {
      this._version = this._stamp;
      this._changed = false;
    }
  }

  private _physical(row: number): number {
    return (this._top + row) % this._rows;
  }

  private _print(code: number): void {
    if (this._pendingWrap) {
      this._wrapped[this._physical(this._cursorRow)] = 1;
      this._pendingWrap = false;
      this._cursorColumn = 0;
      this._lineFeed();
    }
    this._setCell(this._cursorRow, this._cursorColumn, code);
    if (this._cursorColumn === this._columns - 1) {
      this._pendingWrap = true;
    } else {
      this._cursorColumn++;
    }
    this._changed = true;
  }

  private _control(code: number): void {
    const lastColumn = this._columns - 1;
    // With a wrap pending the cursor counts as one past the last column.
    const column = this._pendingWrap ? this._columns : this._cursorColumn;
    switch (code) {
      case BS:
        if (column > 0) {
          this._moveTo(this._cursorRow, column - 1);
          this._setCell(this._cursorRow, this._cursorColumn, EMPTY);
        }
        return;
      case HT:
        this._moveTo(
          this._cursorRow,
          Math.min(lastColumn, (Math.floor(column / TAB_STOP) + 1) * TAB_STOP)
        );
        return;
      case LF:
        this._moveTo(this._cursorRow, 0);
        this._lineFeed();
        return;
      case HOME:
        this._moveTo(0, 0);
        return;
      case FF:
        this._clearScreen();
        this._moveTo(0, 0);
        return;
      case CR:
        this._moveTo(this._cursorRow, 0);
        return;
      case RIGHT:
        this._moveTo(this._cursorRow, Math.min(lastColumn, column + 1));
        return;
      case LEFT:
        this._moveTo(this._cursorRow, Math.max(0, column - 1));
        return;
      case UP:
        this._moveTo(Math.max(0, this._cursorRow - 1), this._cursorColumn);
        return;
      case DOWN:
        this._moveTo(
          Math.min(this._rows - 1, this._cursorRow + 1),
          this._cursorColumn
        );
        return;
      case DEL:
        this._setCell(this._cursorRow, this._cursorColumn, EMPTY);
        return;
    }
  }

  private _moveTo(row: number, column: number): void {
    if (
      row !== this._cursorRow ||
      column !== this._cursorColumn ||
      this._pendingWrap
    ) {
      this._cursorRow = row;
      this._cursorColumn = column;
      this._pendingWrap = false;
      this._changed = true;
    }
  }

  /** Down one row, scrolling the top row into the scrollback at the bottom. */
  private _lineFeed(): void {
    if (this._cursorRow < this._rows - 1) {
      this._cursorRow++;
      this._changed = true;
      return;
    }
    const leaving = this._top;
    this._pushScrollback({
      kind: 'line',
      text: this.rowText(0),
      wrapped: this._wrapped[leaving] === 1
    });
    this._pushLost(leaving);
    this._cells[leaving].fill(EMPTY);
    this._wrapped[leaving] = 0;
    this._rowText[leaving] = '';
    this._top = (this._top + 1) % this._rows;
    this._allRowsStamp = this._stamp;
    this._changed = true;
  }

  // The rows are discarded, but what was lost after them happened.
  private _clearScreen(): void {
    for (let row = 0; row < this._rows; row++) {
      this._pushLost(this._physical(row));
    }
    for (let row = 0; row < this._rows; row++) {
      this._cells[row].fill(EMPTY);
      this._rowText[row] = '';
    }
    this._wrapped.fill(0);
    this._allRowsStamp = this._stamp;
    this._changed = true;
  }

  private _setCell(row: number, column: number, code: number): void {
    const physical = this._physical(row);
    const cells = this._cells[physical];
    if (cells[column] === code) {
      return;
    }
    cells[column] = code;
    this._rowText[physical] = null;
    this._rowStamp[physical] = this._stamp;
    this._changed = true;
  }

  private _pushScrollback(entry: TerminalScrollbackEntry): void {
    this._scrollback[this._scrollbackEnd % TERMINAL_SCROLLBACK_LIMIT] = entry;
    this._scrollbackEnd++;
    this._changed = true;
  }

  private _pushLost(physical: number): void {
    const count = this._rowLost[physical];
    if (count > 0) {
      this._pushScrollback({ kind: 'lost', count });
      this._rowLost[physical] = 0;
    }
  }

  private _buildText(physical: number): string {
    const cells = this._cells[physical];
    let length = this._columns;
    while (length > 0 && cells[length - 1] === EMPTY) {
      length--;
    }
    const scratch = this._scratch;
    for (let i = 0; i < length; i++) {
      scratch[i] = terminalGlyph(cells[i]);
    }
    return String.fromCharCode(...scratch.subarray(0, length));
  }
}
